import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PortCreateInput, PortUpdateInput, PortListQuery } from '@portlog/schemas';

const PORT_SELECT = {
  id: true,
  name: true,
  abbreviation: true,
  location: true,
  parentId: true,
  comments: true,
} as const;

const MAX_DEPTH = 3;

export interface PortNode {
  id: string;
  name: string;
  abbreviation: string | null;
  location: string | null;
  parentId: string | null;
  comments: string | null;
}

export interface PortTreeNode extends PortNode {
  children: PortTreeNode[];
}

@Injectable()
export class PortsService {
  private readonly logger = new Logger(PortsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // list — cursor-paginated; parentId=null → top-level; parentId=<id> → children
  // ---------------------------------------------------------------------------
  async list(query: PortListQuery) {
    const { q, limit, cursor, parentId } = query;

    // parentId in query string comes as string | null | undefined via Zod nullish()
    // If parentId is explicitly null → filter top-level (parentId IS NULL)
    // If parentId is a string → filter children of that parent
    // If parentId is undefined → no parentId filter (return all, for search use-cases)
    let parentFilter: { parentId: string | null } | undefined;
    if (parentId === null) {
      parentFilter = { parentId: null };
    } else if (typeof parentId === 'string') {
      parentFilter = { parentId };
    }

    const items = await this.prisma.port.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        ...parentFilter,
      },
      orderBy: { name: 'asc' },
      select: PORT_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((p) => ({ ...p, label: p.name })),
      nextCursor,
      hasMore,
    };
  }

  // ---------------------------------------------------------------------------
  // getById — includes parent and children (single level)
  // ---------------------------------------------------------------------------
  async getById(id: string) {
    const port = await this.prisma.port.findUnique({
      where: { id },
      select: {
        ...PORT_SELECT,
        parent: { select: { id: true, name: true, abbreviation: true } },
        children: {
          select: { id: true, name: true, abbreviation: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!port) {
      throw new NotFoundException(`Port ${id} not found.`);
    }

    return port;
  }

  // ---------------------------------------------------------------------------
  // getTree — full hierarchy in one call, max 3 levels, built in-memory
  // ---------------------------------------------------------------------------
  async getTree() {
    const nodes = await this.prisma.port.findMany({
      orderBy: { name: 'asc' },
      select: PORT_SELECT,
    });

    // Build adjacency map
    const map = new Map<string, PortTreeNode>();
    for (const n of nodes) {
      map.set(n.id, { ...n, children: [] });
    }

    const roots: PortTreeNode[] = [];
    for (const n of nodes) {
      const node = map.get(n.id)!;
      if (n.parentId === null || n.parentId === undefined) {
        roots.push(node);
      } else {
        const parent = map.get(n.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphan (parent not found) — treat as root
          roots.push(node);
        }
      }
    }

    // Validate depth ≤ MAX_DEPTH
    this.assertMaxDepth(roots, 1);

    return roots;
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  async create(input: PortCreateInput) {
    if (input.parentId) {
      await this.assertParentExists(input.parentId);
      await this.assertDepthAllowed(input.parentId);
    }

    return await this.prisma.port.create({
      data: input,
      select: PORT_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // update — rejects moving a node under one of its descendants (cycle prevention)
  // ---------------------------------------------------------------------------
  async update(id: string, input: PortUpdateInput) {
    await this.assertExists(id);

    if (input.parentId !== undefined && input.parentId !== null) {
      // Prevent self-reference
      if (input.parentId === id) {
        throw new BadRequestException('A port cannot be its own parent.');
      }
      // Prevent cycles: the new parent must not be a descendant of this node
      await this.assertNoCycle(id, input.parentId);
      // Validate depth after reparenting
      await this.assertDepthAllowed(input.parentId);
    }

    return await this.prisma.port.update({
      where: { id },
      data: input,
      select: PORT_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // remove — only when node has no children; ADM only (enforced by controller)
  // ---------------------------------------------------------------------------
  async remove(id: string) {
    await this.assertExists(id);

    const childCount = await this.prisma.port.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(`Port ${id} has ${childCount} child node(s). Remove them first.`);
    }

    await this.prisma.port.delete({ where: { id } });
    this.logger.log({ event: 'ports.delete', id });
  }

  // ---------------------------------------------------------------------------
  // search — quick type-ahead for parent picker
  // ---------------------------------------------------------------------------
  async search(q: string) {
    const items = await this.prisma.port.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((p) => ({ id: p.id, label: p.name }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.port.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Port ${id} not found.`);
    }
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.port.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException(`Parent port ${parentId} not found.`);
    }
  }

  /**
   * Walk the parentId chain from `parentId` upward and ensure the total depth
   * of a new child would not exceed MAX_DEPTH.
   */
  private async assertDepthAllowed(parentId: string): Promise<void> {
    let depth = 1; // depth of the parent node
    let currentId: string | null = parentId;

    while (currentId !== null) {
      const node: { parentId: string | null } | null = await this.prisma.port.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!node) break;
      depth++;
      currentId = node.parentId ?? null;
    }

    // depth is now the depth of the existing parent; child would be depth+1
    if (depth >= MAX_DEPTH) {
      throw new BadRequestException(
        `Cannot create child: hierarchy would exceed ${MAX_DEPTH} levels.`,
      );
    }
  }

  /**
   * Walk descendants of `nodeId` to check if `targetParentId` is among them.
   * If yes, setting targetParentId as the parent of nodeId would create a cycle.
   */
  private async assertNoCycle(nodeId: string, targetParentId: string): Promise<void> {
    // Collect all descendants of nodeId in memory
    const descendants = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.prisma.port.findMany({
        where: { parentId: current },
        select: { id: true },
      });
      for (const child of children) {
        if (!descendants.has(child.id)) {
          descendants.add(child.id);
          queue.push(child.id);
        }
      }
    }

    if (descendants.has(targetParentId)) {
      throw new BadRequestException(
        'Cannot move port: the target parent is a descendant of this node (cycle detected).',
      );
    }
  }

  /**
   * Recursively validate tree depth; throws if any branch exceeds MAX_DEPTH.
   */
  private assertMaxDepth(nodes: PortTreeNode[], currentDepth: number): void {
    for (const node of nodes) {
      if (currentDepth > MAX_DEPTH) {
        throw new ConflictException(
          `Port hierarchy exceeds the maximum of ${MAX_DEPTH} levels (node ${node.id}).`,
        );
      }
      if (node.children.length > 0) {
        this.assertMaxDepth(node.children, currentDepth + 1);
      }
    }
  }
}

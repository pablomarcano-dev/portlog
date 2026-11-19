FROM postgres:16.16-alpine

# The upstream gosu binary embeds an obsolete Go runtime. Alpine's native
# su-exec provides the entrypoint's privilege drop without that unused runtime.
RUN apk add --no-cache su-exec \
    && sed -i 's/exec gosu /exec su-exec /g' /usr/local/bin/docker-entrypoint.sh \
    && grep -q 'exec su-exec postgres' /usr/local/bin/docker-entrypoint.sh \
    && rm /usr/local/bin/gosu \
    && test ! -e /usr/local/bin/gosu

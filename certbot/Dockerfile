FROM certbot/certbot:v5.10.0

# Certbot is installed already. Remove pip and its vulnerable vendored build
# dependencies; certificate issuance/renewal does not need an installer.
RUN python -m pip uninstall --yes pip && certbot --version

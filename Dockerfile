FROM nginx:1.30.6-alpine3.24

RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY src/ /usr/share/nginx/html/

# Nginx tourne avec l'utilisateur « nginx » et non avec root. Il lui faut un fichier PID et un
# dossier de cache accessibles. La ligne « user » de la configuration principale n'a de sens
# que pour root : on la retire. Le port 80 reste utilisable sans root dans un conteneur
# (Docker 20.10 ou plus).
RUN sed -i -e 's#^pid .*#pid /tmp/nginx.pid;#' -e '/^user /d' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /var/cache/nginx

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1

const Route = require("route-parser");

const isPromise = p =>
  p !== null && typeof p === "object" && typeof p.then === "function";

class Router {
  constructor() {
    this.middlewares = [];
  }

  use(...middlewares) {
    const route =
      typeof middlewares[0] === "string" ? middlewares.splice(0, 1)[0] : null;

    this.middlewares.push({
      route,
      middlewares
    });
  }

  getMiddlewares() {
    return this.middlewares;
  }

  handle(event, ...args) {
    const callback = typeof args[1] === "function" ? args[1] : args[0];
    const context = typeof args[0] === "object" ? args[0] : {};

    let q = [...this.middlewares];

    const promise = new Promise((resolve, reject) => {
      this.req = Object.assign(
        {},
        {
          event,
          context
        }
      );

      this.res = {
        props: {},
        headers: {},
        statusCode: 200,
        set: headers => {
          Object.assign(this.res.headers, headers);
          return this.res;
        },
        status: statusCode => {
          this.res.statusCode = statusCode;
          return this.res;
        },
        send: (body = "") => {
          if (typeof body !== "string") {
            this.res.error("[Router error]: res.send called with non-string");
          }

          const response = {
            body,
            headers: this.res.headers,
            statusCode: this.res.statusCode
          };

          if (callback) callback(null, response);

          resolve(response);
        },
        error: err => {
          if (callback) callback(err);

          reject(err);
        }
      };

      const next = err => {
        const nextMiddleware = q.splice(0, 1)[0];

        if (err && !nextMiddleware) {
          this.res.error(err);
        }

        if (!nextMiddleware) return null;

        if (nextMiddleware instanceof Router) {
          const subRouter = nextMiddleware;
          this.q = [...subRouter.getMiddlewares(), ...q];
        }

        if (nextMiddleware.middlewares && nextMiddleware.middlewares.length) {
          if (typeof nextMiddleware.route === "string") {
            const router = new Route(nextMiddleware.route);
            const match = router.match(this.req.event.requestContext.path);

            if (!match) {
              return next();
            }

            this.req.params = match;
          }

          q = [...nextMiddleware.middlewares, ...q];
        }

        if (
          err &&
          (typeof nextMiddleware !== "function" || nextMiddleware.length !== 4)
        ) {
          return next(err);
        }

        if (typeof nextMiddleware === "function") {
          const result = nextMiddleware(this.req, this.res, next, err);
          if (isPromise(result)) {
            result.catch(promiseError => {
              next(
                promiseError ||
                  new Error(`Caught falsey error in promise: ${promiseError}`)
              );
            });
          }
          return result;
        }

        try {
          return next();
        } catch (caughtError) {
          return next(caughtError);
        }
      };

      next.route = err => {
        while (typeof q[0] === "function") {
          q.splice(0, 1);
        }
        next(err);
      };

      try {
        next();
      } catch (unhandledError) {
        this.res.error(unhandledError);
      }
    });

    if (callback) {
      promise.catch(this.res.error);
      return undefined;
    }

    return promise;
  }
}

module.exports = Router;

/* eslint-disable consistent-return */
const Route = require("route-parser");

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

  handle(...args) {
    const [event, context = {}, callback] =
      args.length === 3 ? args : [args[0], {}, args[1]];

    if (typeof callback !== "function") {
      throw new Error(
        "You must supply a callback to router.handle i.e. router.handle(evt, ctx, cb) or router.handle(evt, cb)"
      );
    }

    let q = [...this.middlewares];

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
      send: body => {
        if (typeof body !== "string") {
          this.res.error("[Router error]: res.send called with non-string");
        }
        callback(null, {
          body,
          headers: this.res.headers,
          statusCode: this.res.statusCode
        });
      },
      error: err => {
        const msg = err ? err.toString() : "Internal error";
        console.log(msg); // eslint-disable-line no-console
        callback(msg);
      }
    };

    const next = err => {
      const nextMiddleware = q.splice(0, 1)[0];

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

      if (err) {
        if (
          typeof nextMiddleware === "function" &&
          nextMiddleware.length === 4
        ) {
          return nextMiddleware(this.req, this.res, next, err);
        }

        return next(err);
      }

      if (typeof nextMiddleware === "function") {
        return nextMiddleware(this.req, this.res, next);
      }

      try {
        const maybePromise = next();
        if (maybePromise && maybePromise.then) {
          maybePromise.catch(promiseError => {
            next(promiseError);
          });
        }
      } catch (caughtError) {
        next(caughtError);
      }
    };

    try {
      next();
    } catch (unhandledError) {
      this.res.status(500).send(unhandledError.toString());
    }
  }
}

module.exports = Router;

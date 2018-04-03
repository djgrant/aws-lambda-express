/* eslint-disable consistent-return, no-underscore-dangle */
const Route = require("route-parser");

class Router {
  constructor() {
    this.q = [];
  }

  use(...middlewares) {
    const route =
      typeof middlewares[0] === "string" ? middlewares.splice(0, 1)[0] : null;

    this.q.push({
      route,
      middlewares
    });
  }

  _getQ() {
    return this.q;
  }

  respondTo(event, context = {}) {
    this.req = Object.assign(
      {},
      {
        event,
        context
      }
    );

    this.res = {};

    const next = () => {
      const nextMiddleware = this.q.splice(0, 1)[0];

      if (!nextMiddleware) return;

      if (typeof nextMiddleware === "function") {
        return nextMiddleware(this.req, this.res, next);
      }

      if (nextMiddleware instanceof Router) {
        const subRouter = nextMiddleware;
        this.q = [...subRouter._getQ(), ...this.q];
        return next();
      }

      if (nextMiddleware.middlewares && nextMiddleware.middlewares.length) {
        if (typeof nextMiddleware.route === "string") {
          const router = new Route(nextMiddleware.route);
          const match = router.match(this.req.event.requestContext.path);

          if (!match) return next();

          this.req.params = match;
        }

        this.q = [...nextMiddleware.middlewares, ...this.q];

        return next();
      }
    };

    try {
      next();
      return Promise.resolve(this.res);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

module.exports = Router;

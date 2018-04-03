const Router = require("../src/router");

describe("router", () => {
  const event = { requestContext: { path: "" } };
  const context = {};

  describe("router.respondTo", () => {
    it("passes req and res to middleware", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use(middleware);
      router.respondTo(event, context);

      const expectedReq = { event, context };
      const expectedRes = {};
      const expectedNext = expect.any(Function);

      expect(middleware).toBeCalledWith(expectedReq, expectedRes, expectedNext);
    });

    it("resolves with the response object", () => {
      const router = new Router();

      router.use((req, res) => {
        res.test = 1;
      });

      expect(router.respondTo(event)).resolves.toEqual({
        test: 1
      });
    });

    it("catches errors", () => {
      const router = new Router();
      const middlewareError = new Error("Middleware Error");

      router.use(() => {
        throw middlewareError;
      });

      expect(router.respondTo(event)).rejects.toEqual(middlewareError);
    });
  });

  describe("router.use", () => {
    afterEach(() => {
      event.routerContext = { path: "" };
    });

    it("matches a route", () => {
      const router = new Router();
      const middleware = jest.fn();
      const middleware2 = jest.fn();

      event.requestContext.path = "/path/a/b";

      router.use("/path/:to/:match", middleware);
      router.use("/paths/:not/:match", middleware2);
      router.respondTo(event);

      expect(middleware).toBeCalled();
      expect(middleware2).not.toBeCalled();
    });

    it("adds the matching router params to the request object", done => {
      const router = new Router();

      event.requestContext.path = "/path/a/b";

      router.use("/path/:to/:match", req => {
        expect(req.params).toEqual({
          to: "a",
          match: "b"
        });
        done();
      });

      router.respondTo(event);
    });

    it("continues middleware chain if route does not match", () => {
      const router = new Router();
      const middleware = jest.fn();
      const middleware2 = jest.fn();

      event.requestContext.path = "/path/a/b";

      router.use("/notpath/:to/:match", middleware);
      router.use("/path/:to/:match", middleware2);
      router.respondTo(event);

      expect(middleware).not.toBeCalled();
      expect(middleware2).toBeCalled();
    });

    it("calls next middleware", () => {
      const router = new Router();
      const middleware1 = jest.fn((req, res, next) => next());
      const middleware2 = jest.fn((req, res, next) => next());
      const middleware3 = jest.fn((req, res, next) => next());
      const middleware4 = jest.fn();

      router.use(middleware1);
      router.use(middleware2);
      router.use(middleware3, middleware4);
      router.respondTo(event);

      expect(middleware1).toBeCalled();
      expect(middleware2).toBeCalled();
      expect(middleware3).toBeCalled();
      expect(middleware4).toBeCalled();
    });

    it("stops middleware chain", () => {
      const router = new Router();
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();

      router.use(middleware1);
      router.use(middleware2);
      router.respondTo(event);

      expect(middleware1).toBeCalled();
      expect(middleware2).not.toBeCalled();
    });

    it("stops middleware chain (multiple arguments)", () => {
      const router = new Router();
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();

      router.use(middleware1, middleware2);
      router.respondTo(event);

      expect(middleware1).toBeCalled();
      expect(middleware2).not.toBeCalled();
    });

    it("passes the response object between middleware", () => {
      const router = new Router();

      router.use((req, res, next) => {
        res.test = 1;
        next();
      });

      router.use(
        (req, res, next) => {
          res.test += 1;
          next();
        },
        (req, res) => {
          res.test += 1;
        }
      );

      return router.respondTo(event).then(res => {
        expect(res.test).toBe(3);
      });
    });

    it("accepts other routers as middleware", () => {
      const router = new Router();
      const subRouter = new Router();
      const middleware = jest.fn();

      subRouter.use(middleware);

      router.use(subRouter);
      router.respondTo(event);

      expect(middleware).toBeCalled();
    });

    it("mounts a sub router at a specified path", () => {
      const router = new Router();
      const subRouter = new Router();
      const subRouter2 = new Router();
      const middleware = jest.fn();
      const middleware2 = jest.fn();

      event.requestContext.path = "/sub/test";

      subRouter.use("/sub/test", middleware);
      subRouter2.use("/sub/test", middleware2);

      router.use("/sub/*all", subRouter);
      router.use("/notsub/*all", subRouter2);
      router.respondTo(event);

      expect(middleware).toBeCalled();
      expect(middleware2).not.toBeCalled();
    });

    it("continues the middleware chain after a sub router chain finally calls next", () => {
      const router = new Router();
      const subRouter = new Router();
      const middleware = jest.fn((req, res, next) => next());
      const middleware2 = jest.fn();

      subRouter.use(middleware);

      router.use(subRouter);
      router.use(middleware2);
      router.respondTo(event);

      expect(middleware2).toBeCalled();
    });

    it("stops the middleware chain after a sub router has ended", () => {
      const router = new Router();
      const subRouter = new Router();
      const middleware = jest.fn();
      const middleware2 = jest.fn();

      subRouter.use(middleware);

      router.use(subRouter);
      router.use(middleware2);
      router.respondTo(event);

      expect(middleware2).not.toBeCalled();
    });
  });
});

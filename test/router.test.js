const Router = require("../src/router");

describe("router", () => {
  const event = { requestContext: { path: "" } };
  const context = {};

  describe("router.handle", () => {
    it("starts the middleware chain", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use(middleware);
      router.handle(event, context);

      expect(middleware).toBeCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe("request object", () => {
    it("is an object containing event and context", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use(middleware);
      router.handle(event);

      const finalReq = middleware.mock.calls[0][0];
      const expectedReq = expect.objectContaining({ event, context });

      expect(finalReq).toEqual(expectedReq);
    });
  });

  describe("response object", () => {
    it("has properties and methods", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use(middleware);
      router.handle(event);

      const finalRes = middleware.mock.calls[0][1];
      const expectedResponse = expect.objectContaining({
        props: {},
        headers: {},
        statusCode: 200,
        set: expect.any(Function),
        status: expect.any(Function),
        send: expect.any(Function)
      });

      expect(finalRes).toEqual(expectedResponse);
    });

    it("updates headers", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use(
        (req, res, next) => {
          res.set({ a: 1 });
          next();
        },
        (req, res, next) => {
          res.set({ b: 2 });
          next();
        },
        middleware
      );

      router.handle(event);

      const finalRes = middleware.mock.calls[0][1];
      const expectedRes = expect.objectContaining({
        headers: { a: 1, b: 2 }
      });

      expect(finalRes).toEqual(expectedRes);
    });

    it("updates status code", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use((req, res, next) => {
        res.status(404);
        next();
      }, middleware);

      router.handle(event);

      const finalRes = middleware.mock.calls[0][1];
      const expectedRes = expect.objectContaining({
        statusCode: 404
      });

      expect(finalRes).toEqual(expectedRes);
    });

    it("calls the provided callback with the response data", () => {
      const router = new Router();
      const cb = jest.fn();

      router.use((req, res) => {
        res.set({ a: 1, b: 2 });
        res.status(404);
        res.send("Hello world");
      });

      router.handle(event, context, cb);

      expect(cb).toBeCalledWith({
        body: "Hello world",
        statusCode: 404,
        headers: { a: 1, b: 2 }
      });
    });

    it("chains methods", () => {
      const router = new Router();
      const middleware = jest.fn();

      router.use((req, res, next) => {
        res
          .set({ a: 1, b: 2 })
          .status(200)
          .send("Hello");
        next();
      }, middleware);

      const finalRes = middleware.mock.calls[0][1];
      const expectedRes = expect.objectContaining({
        statusCode: 200,
        headers: { a: 1, b: 2 },
        body: "Hello"
      });

      expect(finalRes).toEqual(expectedRes);
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
      router.handle(event);

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

      router.handle(event);
    });

    it("continues middleware chain if route does not match", () => {
      const router = new Router();
      const middleware = jest.fn();
      const middleware2 = jest.fn();

      event.requestContext.path = "/path/a/b";

      router.use("/notpath/:to/:match", middleware);
      router.use("/path/:to/:match", middleware2);
      router.handle(event);

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
      router.handle(event);

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
      router.handle(event);

      expect(middleware1).toBeCalled();
      expect(middleware2).not.toBeCalled();
    });

    it("stops middleware chain (multiple arguments)", () => {
      const router = new Router();
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();

      router.use(middleware1, middleware2);
      router.handle(event);

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

      return router.handle(event).then(res => {
        expect(res.test).toBe(3);
      });
    });

    it("accepts other routers as middleware", () => {
      const router = new Router();
      const subRouter = new Router();
      const middleware = jest.fn();

      subRouter.use(middleware);

      router.use(subRouter);
      router.handle(event);

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
      router.handle(event);

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
      router.handle(event);

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
      router.handle(event);

      expect(middleware2).not.toBeCalled();
    });

    it("passes an error to the next error handling middleware", () => {
      const router = new Router();
      const middleware = jest.fn();

      const testError = new Error("Test error");
      let testError2;

      const errorMiddleware = jest.fn((req, res, next, err) => {
        testError2 = new Error(err);
        next(testError2);
      });

      const errorMiddleware2 = jest.fn((req, res, next, err) => {
        res.status(500).send(err);
      });

      router.use(
        (req, res, next) => {
          next(testError);
        },
        middleware,
        errorMiddleware,
        middleware,
        errorMiddleware2
      );

      router.handle(event);

      expect(middleware).not.toBeCalled();
      expect(errorMiddleware.mock.calls[0][3]).toBe(testError);
      expect(errorMiddleware2.mock.calls[0][3]).toBe(testError2);
    });

    it("catches errors and passes them to the next error handling middleware", () => {
      const router = new Router();
      const middleware = jest.fn();
      const errorMiddleware = jest.fn((req, res, next, err) => next(err));
      const testError = new Error("Test error");

      router.use(
        () => {
          throw testError;
        },
        middleware,
        errorMiddleware
      );

      router.handle(event);

      expect(middleware).not.toBeCalled();
      expect(errorMiddleware.mock.calls[0][3]).toBe(testError);
    });
  });
});

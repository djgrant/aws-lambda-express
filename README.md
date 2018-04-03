# aws-lambda-express

Express style routing for AWS Lambda.

The library provides a similar API to Express, with the difference of being backed by Lambda's event and context objects, rather than the HTTP module.

## Installation

The project is still a WIP so I have not published to NPM yet.

## Usage

```js
const Router = require("aws-lambda-express");

const router = new Router();

router.use((req, res, next) => {
  console.log(req.event);
  console.log(req.context);
  next();
});

router.use("/some/route", (req, res, next) => {
  res
    .set({ "my-header": "hello" })
    .status(200)
    .send("Hello world");
});

const handler = (event, context, cb) => {
  router
    .handle(event, context)
    .then(response => {
      cb(null, {
        body: response.body,
        headers: response.headers,
        statusCode: response.statusCode
      });
    })
    .catch(err) => {
      cb(err);
    });
};

module.exports = handler;
```

## API

For now, please refer to the tests in [test/router.test.js](./test/router.test.js) for a complete API reference.

## Todo

* [] HTTP methods
* [] Docs
* [] Publish to NPM

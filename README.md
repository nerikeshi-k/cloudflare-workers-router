# cloudflare-workers-tiny-router

0 dependencies tiny router for cloudflare workers

# usage

## 1. Create router

```ts
const router = new Router();
```

## 2. Add static paths

```ts
router.get('/', async (req) => new Response('index page'));
router.post('/articles', async (req) => {
  // create article, etc
  return new Response('article created response');
});
```

## 3. Add dynamic paths

```ts
router.get('/articles/:id', async (req, params) => {
  // get article, etc
  return new Response('article response');
});

router.get('/articles/setting', async (req, params) => {
  // will match '/articles/setting'
  return new Response('article setting response');
});

router.get('/static/*', async (req) => {
  // handle any static assets
  return new Response('statics');
});
```

## 4. Handle Request

```ts
addEventListener('fetch', (event) => {
  return event.respondWith(router.handle(event.request));
});
```

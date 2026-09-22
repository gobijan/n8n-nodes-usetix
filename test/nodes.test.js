const test = require('node:test');
const assert = require('node:assert/strict');
const { Usetix } = require('../dist/nodes/Usetix/Usetix.node');
const { UsetixTrigger } = require('../dist/nodes/UsetixTrigger/UsetixTrigger.node');
const sample = {
  id: '123',
  action: 'order.paid',
  eventable: { items: [{ event_slug: 'summer-show' }] },
};
function context(parameters = {}, responses = []) {
  const calls = [];
  const data = {};
  const result = {
    calls,
    data,
    getNode: () => ({
      id: 'node-1',
      name: 'Usetix',
      type: 'usetix',
      typeVersion: 1,
      position: [0, 0],
    }),
    getNodeParameter: (key, index, fallback) => parameters[key] ?? fallback ?? index,
    getCurrentNodeParameter: (key) => parameters[key],
    getWorkflow: () => ({ id: 'workflow-1', name: 'Guest list' }),
    getWorkflowStaticData: () => data,
    getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/test',
    getInputData: () => [{ json: {} }, { json: {} }],
    continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: async function (credential, options) {
        calls.push({ credential, ...options });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        assert.notEqual(response, undefined, 'Unexpected HTTP request');
        return response;
      },
      returnJsonArray: (value) => [{ json: value }],
    },
  };
  return result;
}
test('guest writes keep input pairing and map the source key on every item', async () => {
  const ctx = context(
    {
      resource: 'guest',
      operation: 'create',
      authentication: 'apiToken',
      eventSlug: 'summer-show',
      requestKey: 'source-1',
      customerName: 'Alex',
      partySize: 1,
      ticketId: 3,
      guestFields: { event_place_ids: [4] },
    },
    [{ public_id: 'party-1' }, { public_id: 'party-1' }],
  );
  const [result] = await new Usetix().execute.call(ctx);
  assert.deepEqual(
    result.map((item) => item.pairedItem),
    [{ item: 0 }, { item: 1 }],
  );
  assert.equal(ctx.calls[0].headers['Idempotency-Key'], 'source-1');
  assert.deepEqual(ctx.calls[0].body.guest_party.event_place_ids, [4]);
  assert.equal(ctx.calls[0].credential, 'usetixApi');
});
test('list includes past and future events and respects the chosen limit', async () => {
  const ctx = context(
    {
      resource: 'event',
      operation: 'getAll',
      authentication: 'oAuth2',
      returnAll: false,
      limit: 1,
    },
    [{ upcoming_events: [{ id: 1 }], past_events: [{ id: 2 }] }],
  );
  ctx.getInputData = () => [{ json: {} }];
  const [result] = await new Usetix().execute.call(ctx);
  assert.equal(result.length, 1);
  assert.equal(ctx.calls[0].credential, 'usetixOAuth2Api');
});
test('subscription recovery adopts and repairs an existing callback without duplicating it', async () => {
  const ctx = context({ events: ['order.paid'] }, [
    {
      webhooks: [
        {
          id: 42,
          name: 'n8n · Guest list',
          active: false,
          url: 'https://n8n.example.com/webhook/test',
          subscribed_actions: ['event.published'],
        },
      ],
    },
    {},
    {},
  ]);
  assert.equal(await new UsetixTrigger().webhookMethods.default.checkExists.call(ctx), true);
  assert.equal(ctx.data.webhookId, '42');
  assert.deepEqual(
    ctx.calls.slice(1).map((call) => call.method),
    ['PATCH', 'POST'],
  );
});
test('subscription lifecycle stores only identifiers and removes its remote hook', async () => {
  const ctx = context({ events: ['order.paid'], eventSlug: '' }, [
    { id: 42, signing_secret: 'never-store' },
    {},
  ]);
  const hook = new UsetixTrigger().webhookMethods.default;
  await hook.create.call(ctx);
  assert.equal(ctx.data.webhookId, '42');
  assert.equal(JSON.stringify(ctx.data).includes('never-store'), false);
  await hook.delete.call(ctx);
  assert.deepEqual(ctx.data, {});
  assert.equal(ctx.calls[1].method, 'DELETE');
});
test('callbacks discard forged bodies and fetch the signed original', async () => {
  const ctx = context({ events: ['order.paid'], eventSlug: 'summer-show' }, [sample]);
  ctx.data.webhookId = '42';
  ctx.getHeaderData = () => ({
    'x-webhook-id': '42',
    'x-webhook-delivery-id': '84',
    'x-webhook-signature': 'a'.repeat(64),
  });
  ctx.getBodyData = () => ({ id: 'forged' });
  const result = await new UsetixTrigger().webhook.call(ctx);
  assert.deepEqual(result.workflowData, [[{ json: sample }]]);
  assert.equal(ctx.calls[0].url, 'https://app.usetix.io/admin/webhooks/42/deliveries/84');
});
test('wrong subscription signatures never start a workflow or call the API', async () => {
  const ctx = context();
  ctx.data.webhookId = '42';
  ctx.getHeaderData = () => ({ 'x-webhook-id': '99' });
  ctx.getResponseObject = () => ({
    status: (code) => {
      assert.equal(code, 401);
      return { json() {} };
    },
  });
  assert.equal((await new UsetixTrigger().webhook.call(ctx)).noWebhookResponse, true);
  assert.equal(ctx.calls.length, 0);
});

test('revoked or expired delivery access rejects the callback without starting a workflow', async () => {
  const error = Object.assign(new Error('Not found'), { statusCode: 404 });
  const ctx = context({ events: ['order.paid'] }, [error]);
  ctx.data.webhookId = '42';
  ctx.getHeaderData = () => ({
    'x-webhook-id': '42',
    'x-webhook-delivery-id': '84',
    'x-webhook-signature': 'a'.repeat(64),
  });
  ctx.getResponseObject = () => ({
    status: (code) => {
      assert.equal(code, 401);
      return { json() {} };
    },
  });
  assert.equal((await new UsetixTrigger().webhook.call(ctx)).noWebhookResponse, true);
});

test('changing an existing trigger to an incompatible voucher filter fails before subscribing', async () => {
  const ctx = context({ events: ['voucher.issued'], eventSlug: 'summer-show' });
  await assert.rejects(
    new UsetixTrigger().webhookMethods.default.checkExists.call(ctx),
    /Voucher notifications cannot be filtered/,
  );
  assert.equal(ctx.calls.length, 0);
});

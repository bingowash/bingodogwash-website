import { runMarketingAutomation } from './_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js';
let queries = 0;
const db = {
  prepare(sql) {
    queries += 1;
    console.log('prepare called', sql);
    return {
      first: async () => ({ enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0 }),
    };
  },
};
(async () => {
  const result = await runMarketingAutomation({ GIFT_CARD_DB: db }, { trigger: 'test' });
  console.log('result', result);
  console.log('queries', queries);
})();

const test = require('node:test');
const assert = require('node:assert');
const S = require('./schedule.js');

test('Gmail-style flight titles', () => {
  S.configure({ destKeywords: ['나하', 'Naha'] });
  const kind = (title) => S.kindOf({ title });
  assert.strictEqual(kind('Flight to Naha (NH 123)'), 'flightIn');
  assert.strictEqual(kind('flight to Seoul (KE 742)'), 'flightOut');
  assert.strictEqual(kind('항공편: 나하'), 'flightIn');
  assert.strictEqual(kind('항공편 예약 확인'), 'fixed'); // no colon → not a flight
  assert.strictEqual(kind('KE741 인천 → 나하'), 'flightIn');
});

test('overnight flight stays one event; multi-day stay splits into check-in/out', () => {
  S.configure({ destKeywords: ['Naha'] });
  const out = S.expandEvents([
    { id: 'f', title: 'Flight to Naha', startDate: '2027-04-10', start: '23:00', endDate: '2027-04-11', end: '02:00' },
    { id: 'h', title: 'Stay at Hotel', startDate: '2027-04-10', start: '15:00', endDate: '2027-04-12', end: '11:00' },
  ]);
  assert.deepStrictEqual(out.map((e) => e.id), ['f', 'h:in', 'h:out']);
  assert.ok(out[1].title.startsWith('체크인') && out[2].title.startsWith('체크아웃'));
  assert.strictEqual(S.kindOf(out[1]), 'hotelIn');
});

test('flight → airport by name, then by destination keyword', () => {
  S.configure({ destKeywords: ['도쿄', '하네다', 'Tokyo'] });
  const airports = [{ id: 'gmp', name: '서울 / 김포 GMP' }, { id: 'hnd', name: '하네다 공항' }, { id: 'nrt', name: 'Narita Airport' }];
  const at = (title) => S.flightAirport({ title }, airports);
  assert.strictEqual(at('Flight to 도쿄 / 하네다 (OZ 1045)'), 'hnd');       // arrival named in title
  assert.strictEqual(at('KE741 김포 → 도쿄(나리타)'), 'hnd');               // 나리타 ≠ "Narita" → destination keyword
  assert.strictEqual(at('KE742 Tokyo Narita → 김포'), 'nrt');                    // outbound leaves from the left side
  assert.strictEqual(at('Flight to 서울 / 김포 (OZ 1085)'), 'hnd');        // outbound, origin unknown → destination airport, not 김포
  assert.strictEqual(S.flightAirport({ title: '라멘 예약' }, airports), null);
  assert.strictEqual(S.flightAirport({ title: 'Flight to 도쿄' }, [airports[0]]), null); // no destination airport → caller falls back
});

test('arrival day starts at the flight\'s own airport', () => {
  S.configure({ destKeywords: ['도쿄'] });
  const ev = [{ id: 'f', date: '12-27', start: '15:50', end: '18:10', title: 'Flight to 도쿄 / 하네다' }];
  const d = S.dayStart('12-27', ev, (e) => (e.id === 'f' ? 'hnd' : null), 'gmp');
  assert.deepStrictEqual([d.placeId, d.min], ['hnd', 18 * 60 + 10 + 60]);
  assert.strictEqual(S.dayStart('12-27', ev, () => null, 'gmp').placeId, 'gmp'); // unlinked → first airport
});

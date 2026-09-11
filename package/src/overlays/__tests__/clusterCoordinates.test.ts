import { expect, test } from 'bun:test';
import { clusterCoordinates } from '../clusterCoordinates';

test('dense cluster expansion fits only its actual members without the SDK minimum region span', () => {
  const first = { latitude: 52.2297, longitude: 21.0122 };
  const second = { latitude: 52.2302, longitude: 21.01285 };
  expect(
    clusterCoordinates(
      ['live', 'sdk'],
      [
        { id: 'outside', coordinate: { latitude: 50, longitude: 20 } },
        { id: 'live', coordinate: first },
        { id: 'sdk', coordinate: second },
      ],
    ),
  ).toEqual([first, second]);
});

test('a stale cluster never fits unrelated markers after its members disappear', () => {
  expect(
    clusterCoordinates(
      ['removed'],
      [{ id: 'new', coordinate: { latitude: 52, longitude: 21 } }],
    ),
  ).toEqual([]);
});

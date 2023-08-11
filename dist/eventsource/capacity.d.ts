/**
 * Determine if a new capacity is needed for a buffer, and if it is, then what
 * that new capacity should be.
 *
 * @param {number} currentCapacity The current capacity of the buffer.
 * @param {number} requiredCapacity The required capacity from the buffer.
 * @param {number} maxOverAllocation The maximum extra capacity to allocate.
 * This is how much the capacity can exceed the required capacity. If the over
 * allocation exceeds this amount (from doubling), then instead the amount
 * over allocated will be equal to maxOverAllocation.
 *
 * @returns {[boolean, number]} Either [false, 0] if no allocation is needed, or [true, <capacity>] if an
 * allocation is needed.
 */
declare function CalculateCapacity(currentCapacity: number, requiredCapacity: number, maxOverAllocation: number): [boolean, number];
export default CalculateCapacity;

import assert from "node:assert/strict"
import test from "node:test"
import {
  billingState,
  countdown,
  formatChangeTime,
  holidayCalendarStatus,
  holidayFor,
  isPeak,
  nextPeakChange,
} from "../src/peak.ts"

test("isPeak marks weekday peak windows in UTC", () => {
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 0, 59))), false)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 1, 0))), true)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 3, 59))), true)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 4, 0))), false)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 6, 0))), true)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 9, 59))), true)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 26, 10, 0))), false)
})

test("isPeak is off-peak all weekend", () => {
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 24, 2, 0))), false)
  assert.equal(isPeak(new Date(Date.UTC(2026, 9, 25, 7, 0))), false)
})

test("Chinese public holidays are off-peak for the whole day", () => {
  const nationalDay = new Date(Date.UTC(2026, 9, 1, 1, 0))
  assert.equal(isPeak(nationalDay), false)
  assert.equal(billingState(nationalDay), "holiday")
  assert.equal(holidayFor(nationalDay)?.name, "National Day")

  const dayBefore = new Date(Date.UTC(2026, 8, 30, 1, 0))
  assert.equal(isPeak(dayBefore), true)
  assert.equal(billingState(dayBefore), "peak")
})

test("holiday detection uses the China calendar day", () => {
  const lateUtc = new Date(Date.UTC(2026, 8, 30, 16, 30))
  assert.equal(holidayFor(lateUtc)?.name, "National Day")
})

test("holiday calendar status reports official, provisional and missing years", () => {
  assert.equal(holidayCalendarStatus(new Date(Date.UTC(2026, 9, 26))), "official")
  assert.equal(holidayCalendarStatus(new Date(Date.UTC(2027, 0, 1))), "provisional")
  assert.equal(holidayCalendarStatus(new Date(Date.UTC(2028, 0, 1))), "missing")
})

test("nextPeakChange finds the next boundary", () => {
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 9, 26, 0, 30)))?.toISOString(),
    "2026-10-26T01:00:00.000Z",
  )
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 9, 26, 3, 30)))?.toISOString(),
    "2026-10-26T04:00:00.000Z",
  )
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 9, 26, 9, 30)))?.toISOString(),
    "2026-10-26T10:00:00.000Z",
  )
})

test("nextPeakChange skips the weekend", () => {
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 9, 23, 10, 0)))?.toISOString(),
    "2026-10-26T01:00:00.000Z",
  )
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 9, 24, 12, 0)))?.toISOString(),
    "2026-10-26T01:00:00.000Z",
  )
})

test("nextPeakChange skips Chinese public holidays", () => {
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 1, 14, 12, 0)))?.toISOString(),
    "2026-02-24T01:00:00.000Z",
  )
  assert.equal(
    nextPeakChange(new Date(Date.UTC(2026, 8, 30, 12, 0)))?.toISOString(),
    "2026-10-08T01:00:00.000Z",
  )
})

test("countdown formats minutes, hours and days", () => {
  const from = new Date(Date.UTC(2026, 9, 26, 0, 0))
  assert.equal(countdown(new Date(Date.UTC(2026, 9, 26, 0, 1)), from), "1m")
  assert.equal(countdown(new Date(Date.UTC(2026, 9, 26, 0, 59)), from), "59m")
  assert.equal(countdown(new Date(Date.UTC(2026, 9, 26, 1, 0)), from), "1h 00m")
  assert.equal(countdown(new Date(Date.UTC(2026, 9, 26, 3, 12)), from), "3h 12m")

  const weekend = new Date(Date.UTC(2026, 9, 23, 10, 0))
  assert.equal(countdown(new Date(Date.UTC(2026, 9, 26, 1, 0)), weekend), "2d 15h")
})

test("formatChangeTime omits the weekday for the same local day", () => {
  const from = new Date(Date.UTC(2026, 9, 26, 0, 0))
  const sameDay = formatChangeTime(new Date(Date.UTC(2026, 9, 26, 1, 0)), from, {
    locale: "en-US",
    timeZone: "UTC",
  })
  assert.match(sameDay, /01:00/)
  assert.doesNotMatch(sameDay, /AM|PM|a\.m\.|p\.m\./i)
  assert.doesNotMatch(sameDay, /Mon|Tue/)

  const nextDay = formatChangeTime(new Date(Date.UTC(2026, 9, 27, 1, 0)), from, {
    locale: "en-US",
    timeZone: "UTC",
  })
  assert.match(nextDay, /Tue/)
  assert.match(nextDay, /01:00/)
})

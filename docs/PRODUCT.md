# Product brief

## Problem

Most time-zone tools optimize for calendar mechanics. They make people mentally
translate rows of clocks and rarely account for the hours each person actually
wants to be contacted.

## Audience

- Families and friends living across countries
- Distributed teams without a shared office schedule
- Community organizers coordinating international volunteers

## Promise

TimeBridge turns local availability into a shared, human-readable calling
window in under one minute, without requiring an account.

## Version 0.1 success criteria

- A visitor can add, edit, and remove locations.
- A visitor can define preferred hours for every location.
- A visitor can choose a meeting length and search horizon.
- Suggested start times prioritize the least-comfortable participant's buffer.
- Calculations remain correct across daylight-saving changes and half-hour zones.
- A visitor can copy a URL that recreates the plan.
- The core workflow works on a 320-pixel-wide screen and with a keyboard.

## Recommendation model

The calculator evaluates every 30-minute start time across the requested date
range. A candidate must keep the entire meeting inside every participant's
availability. Candidates are ranked by their smallest availability-edge buffer,
then by average distance from schedule centers, and finally by time.

The score is deliberately explainable. It is not a claim that the highest-ranked
time is universally best; it offers a fair default that people can discuss.

## Deliberate constraints

- No authentication or stored user profiles
- No calendar access
- No server-side personal data
- No dependency on proprietary time-zone APIs

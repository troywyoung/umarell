# Move admin route to standalone page

Convert the /admin experience into a normal page instead of a fixed overlay. Remove modal-style backdrop behavior from AdminV2, stop requiring modal close semantics, and render the admin content as a full-page layout that owns its own scrolling.

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- AdminV2 no longer uses fixed full-screen overlay positioning or translucent backdrop styling
- AdminV2 no longer closes from backdrop clicks and does not require modal-style onClose behavior
- The /admin route renders the admin UI as a normal page with page-level scrolling
- Navigation away from /admin uses route navigation rather than modal close behavior
- Any now-unused modal-era admin component props or wiring are removed without breaking the existing admin sections

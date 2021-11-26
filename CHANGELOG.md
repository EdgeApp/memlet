# memlet

## Unreleased
- Add `navigateMemlet`

## 0.1.4 (2021-11-26)
- Fix `.delete` bugs
  - Files weren't deleted from cache
  - Race condition caused deleted files to be resurrected from backing-store by `getJson`
- Fix action store memory leak
- Fix incorrect file list from `.list` caused by error optimization
- Add write-policy and integrity tests

## 0.1.3 (2021-11-19)
- Add homepage and repository links to package

## 0.1.2 (2021-11-19)
- Fix cross-instance action queue bug
- Fix unresolved promise bug within action flushing algorithm
- Fix missing delete action bug

## 0.1.1 (2021-6-15)
### Fixed
- Correct queue importing in index.ts

## 0.1.0 (2021-6-1)
### Added
- In-memory write caching

## 0.0.4 (2020-11-23)
### Fixed
- Refactored memlet to use shared state for all instances from makeMemlet

---
title: Game-ops platform and web level editor
period: '2026'
summary: >-
  Designed an engine-agnostic game data format and built an MVP web level
  editor to automate level creation and validation in time-management games.
order: 1
cover: /projects/gameops-platform/cover.jpg
---
The studio makes time-management games. Gameplay changes very little from one game to the next, and most game elements are the same. The editor's main goal is to make game designers and artists less dependent on programmers. Another goal is to automate checking a level's quality and its compliance with the design spec.

## Objectives

* Design an engine-agnostic game data format for the internal game-ops / live-ops platform, so that levels, the objects on them, and other game elements are described by data rather than by project-specific code
* Design and build an MVP level editor
* Automate level validation: quality checks and compliance with the design spec

## My contribution

* Broke the time-management genre down into data: what counts as an entity, a parameter, or a rule
* Designed a JSON schema for game objects, levels, and parameters
* Took the web level editor prototype to MVP
* Separately, improved the existing internal editor: hotkeys, interface ergonomics, export and import pipelines

## Solution

The MVP web editor can:

* create paths
* place objects and workers
* run a playtest manually or with a bot
* calculate the ideal completion time for a level

Stack: JavaScript / React. I only have a surface-level knowledge of the language: the prototype was written with Claude Code, while I was responsible for the data architecture, the logic, and signing off on the result.

## Outcome

* The MVP showed that the approach has real potential for the pipeline
* Integrating the web editor into the rest of the game-ops system was scheduled for the next quarter

## What I'd do differently

I put a lot of effort into the editor's UI/UX, making levels convenient to build. I should have focused more on automation and quality control, since those were the main goals.

---

![Web level editor demo](/projects/gameops-platform/TMNEditor_demo_coded.mp4)

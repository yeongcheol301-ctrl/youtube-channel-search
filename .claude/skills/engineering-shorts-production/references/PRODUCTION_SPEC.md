# CODEX ENGINEERING SHORTS PRODUCTION SYSTEM

## Overview

This file defines a complete Codex-driven workflow for producing vertical engineering explainer shorts in fields such as architecture, civil engineering, mechanical engineering, aerospace, military engineering, fluid dynamics, structural systems, thermodynamics, pressure systems, and related technical subjects.

It is designed to work as a standalone project instruction file. No prior conversation, custom skill, or hidden context should be required.

The production chain is:

```text
Research + Script
→ CLEAN Keyframes
→ INFO Keyframes
→ CLEAN-to-INFO 4s Video Clips
→ TTS-Synced Edit
→ Final Publishing Package
```

The most important requirement is repeatability. Once a stage has been approved or completed, do not recreate it unless the user explicitly requests a revision.

---

# A. PROJECT OPERATING RULES

## A1. Required Tools

The user may use any equivalent tools, but the intended setup is:

- Codex-enabled working environment
- One dedicated project folder per topic
- Image generation tool
- Image-to-video generation tool
- TTS generator
- Premiere Pro or another NLE editor

Example classroom tools may include:

- Google Flow
- Any supported image generation model
- Gemini Omni Flash or an equivalent image-based video model

Model names and features can change. The production logic in this document is more important than any specific vendor or model.

---

## A2. Starting a New Project

1. Create a dedicated folder for the topic.
2. Open that folder as the Codex working directory.
3. Attach this MD file to the new Codex session.
4. Use the following project initialization prompt.

```text
Read the attached CODEX_ENGINEERING_SHORTS_PRODUCTION_SYSTEM.md from beginning to end and treat it as the operating specification for this project.

Topic: [TOPIC]
Target duration: [e.g. 60 seconds / 100 seconds]
Project folder: [ABSOLUTE PROJECT PATH]
Primary phenomenon to visualize: [air / water / soil / heat / pressure / load / vibration / energy]
Image and video platform: [e.g. Google Flow]
Source clip duration: 4 seconds per clip

This is a new project.

First, deepen the topic from an engineering perspective and write the script only.

Do not proceed to image planning or image generation until I approve the script.

Save every completed stage as an MD file inside the project folder and also provide the same output in a copyable code block in the conversation.

If any stage already exists, inspect the current project state first and continue from the latest completed stage instead of rebuilding earlier work.
```

For an existing project, replace the final instruction with:

```text
Current stage: [e.g. CLEAN images completed]

Inspect the existing project assets and documents first.

Do not rebuild completed stages.

Perform only the next required stage.
```

---

## A3. Resume Instead of Restart

Before doing new work:

- Inspect existing scripts, manifests, CLEAN assets, INFO assets, MP4 files, prompts, and status files.
- Never regenerate approved or completed work automatically.
- Only perform the stage requested by the user.
- If the next stage requires approval, present the output and stop.

---

## A4. Approval Gates

Use the following gate order unless the user explicitly asks to skip one or more stages:

1. Topic and engineering thesis
2. Script
3. Scene plan and keyframe count
4. CLEAN generation prompts
5. CLEAN asset review
6. INFO second-pass prompts
7. INFO asset review
8. 4-second video generation prompts
9. MP4 review and filename ordering
10. Final edit and publishing text

Do not move beyond an approval gate without user approval.

If the user explicitly asks for full generation or says to skip testing, follow that instruction.

---

## A5. Recommended Folder Layout

Use this structure when starting from scratch:

```text
[PROJECT]/
  script/
  clean/
  info/
  video/
  edit/
  manifests/
  prompts/
```

If an existing project already uses a different sensible structure, preserve it rather than forcing a migration.

Recommended core files:

```text
script/APPROVED_NARRATION_KR.md
manifests/IMAGE_SEQUENCE.md
manifests/PROJECT_STATUS.md
prompts/CLEAN_KEYFRAME_PROMPTS.md
prompts/INFOGRAPHIC_KEYFRAME_PROMPTS.md
prompts/VIDEO_GENERATION_PROMPTS.md
```

---

## A6. Stable Scene and Asset IDs

Use consistent IDs throughout the project.

Recommended pattern:

```text
Scene: S01A
Keyframe: KF-01A
Video: CLIP01
```

CLEAN, INFO, and MP4 assets must map 1:1 through the same scene/keyframe identity.

Use zero-padded numeric prefixes so alphabetical filename sorting matches narrative order.

```text
01_S01A_KF-01A_CLEAN_[short-description]
01_S01A_KF-01A_INFO_[short-description]
01_CLIP_S01A_KF-01A_[short-description].mp4
```

---

## A7. Local File Safety

- Create and modify files only inside the user-specified project folder.
- Never overwrite original images or videos.
- Before deleting anything, verify that it is genuinely duplicated or invalid.
- Do not trust creation time or filenames alone when determining sequence.
- Verify order using actual visual content.
- If visual inspection is impossible, do not guess. Ask for or create a contact sheet / representative-frame review workflow.

---

# B. ENGINEERING STORY LOGIC

## B1. Define Four Core Statements First

Before writing the script, define:

1. **Central question**  
   The engineering mystery or problem that makes the viewer want to continue.

2. **Main mechanism**  
   The structure, device, physical interaction, or design intervention that solves the problem.

3. **Visible physical flow**  
   The air, water, soil, heat, pressure, load, vibration, energy, or other physical process that can be shown visually.

4. **Unique differentiator**  
   The property that distinguishes this structure, machine, or system from comparable examples.

---

## B2. Preferred Narrative Progression

Use this general causal progression:

```text
Constraint / common assumption
→ growing failure risk or contradiction
→ decisive engineering intervention
→ change in flow / force / pressure / load
→ structural or mechanical response
→ resulting performance benefit
→ real-world cost, limitation, or tradeoff
→ concise conclusion
```

Guidelines:

- Spend roughly the first one-third increasing the question, limitation, contradiction, or risk.
- Use the remaining section to resolve the problem through clear cause-and-effect engineering.
- Focus more on forces, flows, mechanisms, and physical systems than biography or general history.
- Simplification is allowed for clarity.
- Do not invent decisive falsehoods, unsupported measurements, or fake precision.

---

# C. STAGE 1 — RESEARCH AND SCRIPT

Use a prompt equivalent to:

```text
Create a vertical engineering explainer short about [TOPIC] with a target duration of [TARGET LENGTH].

Research reliable primary sources and official references to verify the core mechanism, dimensions, dates, engineering comparisons, and important physical facts.

Clearly distinguish:
- confirmed fact
- disputed interpretation
- visual simplification used for explanation

Do not invent false precision.

Before the script, provide four short statements:

1. Central engineering question
2. Main mechanism
3. Physical flow / force that should be visible on screen
4. Unique differentiator of this subject

Structure the script so that the first roughly one-third increases the problem, uncertainty, contradiction, or limitation.

Then resolve it using the engineering design and the relevant physical process.

Every sentence should advance one new causal step: cause, action, consequence, or engineering response.

Return two versions:

A. Production script with approximate time ranges and visual direction
B. Clean TTS narration with no timeline labels

Stop after the script.

Do not proceed to scene planning, image prompts, or generation until the script is approved.
```

After approval, save the narration to:

```text
script/APPROVED_NARRATION_KR.md
```

After TTS is generated, record the **actual TTS duration**. Do not continue using the estimated script duration when the real audio length is available.

---

# D. STAGE 2 — SCENE MAP AND KEYFRAME COUNT

Use the approved narration and the actual TTS duration.

```text
Using the approved narration and the actual TTS duration of [XX seconds], create the scene and keyframe plan.

Source video clips are 4 seconds each.

In the final edit, roughly 1.5 to 4 seconds of each generated clip may be used.

Create a new scene only when there is a meaningful change in one of the following:

- physical state
- load path
- construction stage
- internal cross-section
- macro mechanism
- scale comparison
- material interaction
- major visual transition

Do not create redundant scenes that differ only by camera angle.

For every scene specify:

- Scene ID
- Keyframe ID
- narration phrase
- scene purpose
- CLEAN visual content
- INFO overlay concept
- expected camera movement

Save all mappings to:

manifests/IMAGE_SEQUENCE.md

Stop after the scene plan.

Do not write image-generation prompts yet.
```

Scene count is not a fixed rule.

Useful starting ranges:

- 55–70 seconds: approximately 16–22 source clips
- 90–110 seconds: approximately 26–36 source clips

The number of real physical states in the narration takes priority over these estimates.

---

# E. STAGE 3 — CLEAN KEYFRAME PROMPTS

CLEAN images are the base visual assets.

They must contain the real engineering scene only, without explanatory graphics.

Use a prompt equivalent to:

```text
Using the approved narration and manifests/IMAGE_SEQUENCE.md, write the complete batch prompt for generating all CLEAN keyframes.

Every keyframe must be an independent vertical 9:16 image.

Do not combine them into a collage, storyboard, contact sheet, or split-screen composition.

Instruct the generation agent to create the complete requested quantity without stopping for confirmation between images.

For each image include:

- scene ID
- keyframe ID
- sortable output filename
- photoreal cinematic 3D engineering-documentary style
- consistent geometry, era, materials, colors, and environment across matching scenes
- foreground, midground, and background depth
- enough spatial depth for a later 5–15 degree camera movement
- physical state
- viewpoint
- lens feel
- lighting
- material appearance
- scene-specific error-prevention rules
- scene-specific forbidden elements

CLEAN images must NOT contain:

- text
- numbers
- symbols
- dimensions
- dimension lines
- arrows
- callout lines
- formulas
- charts
- maps
- UI
- HUD
- subtitles
- logos
- watermarks
- infographic glow

Only show air, water, soil, smoke, dust, heat, particles, or similar effects when they are physically relevant to the scene itself.

Return the entire batch prompt inside one text code block.

Save it as:

prompts/CLEAN_KEYFRAME_PROMPTS.md

Do not generate images in this stage.
```

### CLEAN Quality Standard

- 9:16 vertical
- Recommended resolution: 1080×1920 or higher
- Sufficient scene depth for controlled camera motion
- No excessive neon
- No fantasy-energy aesthetic
- Leave usable visual space for later INFO graphics without making the composition look like an empty template
- Minimize historical, mechanical, structural, and material inaccuracies

---

# F. STAGE 4 — CLEAN ASSET REVIEW

After CLEAN images have been generated externally, review them against the approved scene map.

```text
Review every CLEAN image in the folder below against the approved scene plan.

CLEAN folder:
[ABSOLUTE PATH]

Scene map:
[ABSOLUTE PATH TO IMAGE_SEQUENCE.md]

Check:

- total quantity
- aspect ratio
- actual visual content
- geometry consistency
- continuity of materials and environment
- narration order
- physical state
- camera depth
- absence of INFO graphics
- duplicates
- missing scenes

Do not trust filename or creation time alone.

Inspect actual image content and map every asset to the correct scene/keyframe ID.

If all assets are valid, rename or prefix them so alphabetical filename order matches narration order.

If an image is wrong, report only:
- affected ID
- exact failure
- reason for regeneration

Do not request full-batch regeneration when only specific images are defective.
```

---

# G. STAGE 5 — INFO SECOND-PASS EDIT PROMPTS

INFO is **not a new scene generation pass**.

INFO must be created by editing the corresponding CLEAN keyframe.

The underlying CLEAN image must remain visually the same.

Use a prompt equivalent to:

```text
Using the reviewed CLEAN images, approved narration, and manifests/IMAGE_SEQUENCE.md, write the complete second-pass editing prompts that convert each CLEAN image into its INFO version.

Global preservation rules:

Preserve the CLEAN image's:
- camera
- crop
- lens
- geometry
- parts
- people
- physical state
- lighting
- materials
- textures
- environment
- background

Do not redraw the scene.

Do not rotate, reposition, zoom, shrink, enlarge, replace, or redesign the base object.

The INFO layer must look like model-rendered engineering visualization integrated into real 3D space, not a flat HUD.

Anchor callout lines and arrows to actual structures and physical phenomena.

All overlays must obey:
- perspective
- parallax
- depth
- occlusion

Use a consistent project-wide color system for:
- normal flow
- pressure / danger
- structural information
- key measurements

Organize graphical components so that the later video can assemble them in the following order:

anchor
→ line
→ arrow body
→ arrowhead
→ number
→ label
→ moving pulse / flow cue

Use only verified measurements and units.

Narration carries the explanation and conclusion.

Therefore, do not default to giant titles or sentence-length headings.

Each scene should normally contain:
- 1 to 3 small technical labels
- 0 to 1 critical numeric value

The main visual subject should remain the physical phenomenon, flow, wave, force path, load path, or engineering mechanism.

Only special conclusion scenes may use a short medium-sized statement.

If the matching CLEAN image already exists in the current image-generation conversation, refer to it by the matching ID instead of asking the user to upload it again.

Return all prompts inside one text code block.

Save them as:

prompts/INFOGRAPHIC_KEYFRAME_PROMPTS.md

Do not generate INFO images in this stage.
```

### Example INFO Color Logic

A consistent project palette may use:

- normal flow / acoustic wave / streamline: cyan or teal
- sudden pressure change / impact / danger: orange to red
- moisture / cooling / condensation: white and pale blue
- velocity / key metric / final highlight: gold
- structural / neutral callout line: restrained blue-white

The exact palette may change by topic, but it should remain consistent across the full video.

---

# H. STAGE 6 — INFO REVIEW

Compare CLEAN and INFO assets 1:1 by ID.

```text
Compare every CLEAN and INFO image pair using their shared IDs.

CLEAN folder:
[ABSOLUTE PATH]

INFO folder:
[ABSOLUTE PATH]

Scene map:
[ABSOLUTE PATH TO IMAGE_SEQUENCE.md]

Verify:

- INFO is truly an edit of the same CLEAN composition
- camera is preserved
- geometry is preserved
- people are preserved
- lighting is preserved
- background is preserved
- approved numbers and units are correct
- callout lines terminate on real components or phenomena
- force / pressure / fluid arrows point in the correct direction
- graphics obey perspective and occlusion
- giant titles do not dominate the frame
- each image communicates one primary concept
- there are no missing assets
- there are no duplicates
- IDs are correct

If a problem exists, report only the affected ID and the exact element that must be corrected.

Do not request regeneration of the entire set.
```

---

# I. STAGE 7 — CLEAN TO INFO 4-SECOND VIDEO PROMPTS

Each clip should begin from CLEAN and progressively build toward INFO.

CLEAN is the real starting frame.

INFO is the target reference for the final graphic state.

INFO must not be treated as the opening frame or as a flat board that simply moves.

Use a prompt equivalent to:

```text
Using the approved CLEAN–INFO pairs and manifests/IMAGE_SEQUENCE.md, write the complete image-to-video prompts for independent 4-second engineering clips.

Asset roles:

CLEAN:
- true opening frame
- source of scene geometry
- source of camera framing
- source of lighting
- source of materials

INFO:
- target reference for final graphic content
- target reference for final labels
- target reference for final values
- target reference for overlay positions
- target reference for final colors and composition

Do not use INFO as the first frame.

Do not move INFO as a flat image plate.

Instead, start from CLEAN and progressively construct the infographic elements over the real scene until the final state visually converges on INFO.

Default 4-second construction timing:

0.0–0.4 s
CLEAN only.
Camera movement and natural environmental motion begin.

0.4–0.9 s
Engineering anchor points illuminate or appear on the relevant structures / phenomena.

0.9–1.7 s
Callout lines, wavefronts, dimension lines, flow paths, or arrow bodies construct outward.

1.7–2.6 s
Small Korean technical labels and verified numeric values assemble.
Arrowheads appear only after their lines or bodies have formed.

2.6–3.4 s
Load, pressure, fluid, material, process, or energy pulses travel through their intended paths.

3.4–4.0 s
The composition settles into the final INFO target state and remains readable.

Global video rules:

- each result is a separate 4.0-second clip
- vertical 9:16
- one continuous shot
- no cuts
- use only one restrained camera move per scene
- camera movement should generally stay within approximately 5–15 degrees
- allowed movement styles include subtle orbit, dolly, or tracking
- camera and graphics move independently
- graphics remain anchored to real 3D space
- preserve perspective
- preserve parallax
- preserve occlusion
- every flow has a start point, direction, interaction boundary, and result
- do not invent a giant title not present in INFO
- do not add new subtitles

Forbidden:

- simultaneous full-screen fade-in of all graphics
- flat HUD appearance
- jittering text
- reversed arrows
- excessive neon
- fantasy energy
- structural morphing
- object duplication
- 360-degree rotation
- whip pans
- camera roll

Do not generate:
- narration
- dialogue
- music
- new subtitles
- logos
- watermarks

Prefix final filenames with zero-padded numbering beginning at CLIP01.

For each clip specify:

- CLEAN source ID
- INFO target ID
- output filename
- camera movement
- anchor location
- graphic build order
- moving pulse behavior
- occlusion behavior
- physical direction

Return all prompts inside one text code block.

Save as:

prompts/VIDEO_GENERATION_PROMPTS.md

Do not generate videos in this stage.
```

If the same generation conversation already contains the matching CLEAN and INFO assets, prepend:

```text
The CLEAN and INFO images with matching KF IDs already exist in this conversation.

CLEAN is the real starting image.

INFO is the final target-state reference.

Do not use INFO as the first frame.

Reconstruct the graphics progressively on top of CLEAN until the clip reaches the INFO target state.

Do not ask the user to upload the same images again.
```

If a new generation conversation is used, provide each CLEAN–INFO pair while preserving the exact filenames and IDs.

---

# J. STAGE 8 — MP4 REVIEW AND ORDERING

Review generated video content visually.

Do not rely on file creation time or filenames alone.

```text
Review the MP4 folder against the INFO image folder and the approved scene map using actual visual content.

INFO folder:
[ABSOLUTE PATH]

MP4 folder:
[ABSOLUTE PATH]

Scene map:
[ABSOLUTE PATH TO IMAGE_SEQUENCE.md]

Compare a representative frame from every MP4 with its intended INFO image.

Check:

- image-to-video scene correspondence
- narration order
- missing clips
- duplicated clips
- clip duration
- aspect ratio
- CLEAN opening state
- progressive infographic construction
- independent camera and graphic motion
- geometry stability
- direction of forces and flows
- readability of the final INFO state

After verifying the actual scene content, prefix filenames with 01_, 02_, 03_ and so on so alphabetical filename sorting matches narration order.

Preserve the descriptive portion of each filename.

If deletion of duplicates is necessary, explain the evidence first.

Do not delete anything without approval.
```

---

# K. STAGE 9 — FINAL EDIT

Generated source duration and final narration duration are not expected to match exactly.

Example:

```text
19 clips × 4 seconds = 76 seconds of source footage
Actual TTS = 64 seconds
```

The final edit may therefore remove approximately 12 seconds.

Typical usage:

- problem setup / transitional scene: about 1.5–3 seconds
- central mechanism / payoff scene: about 3–4 seconds
- scene where the graphic build finishes late: keep enough of the completed graphic state
- visually repetitive camera movement: shorten aggressively

In Premiere Pro or another NLE:

1. Sort the project panel by filename ascending.
2. Select clips from 01 through the final numbered clip.
3. Place them on the timeline in that order.

Recommended edit order:

```text
TTS
→ adjust clip durations
→ essential sound effects
→ background music
→ minimal necessary subtitles
→ volume balancing
→ color cleanup
→ final review
```

---

# L. STAGE 10 — TITLE AND DESCRIPTION PACKAGE

Use a prompt equivalent to:

```text
Create the YouTube title and description for the completed engineering short.

Topic:
[TOPIC]

Final duration:
[XX seconds]

Central engineering question:
[QUESTION]

Main mechanism:
[MECHANISM]

Provide:
- 1 recommended title
- 3 alternative titles

Create strong curiosity without making false or exaggerated engineering claims.

Write the description in this order:

1. engineering mystery / problem
2. short explanation of the main mechanism
3. the physical flow / force shown in the video
4. short disclosure that some phenomena were visually simplified for clarity
5. relevant Korean and English hashtags
```

---

# M. MASTER QUALITY CONTROL

## Script

Confirm that:

- the first 3 seconds contain a clear question, contradiction, or hook
- the early section increases the problem or constraint
- the later section resolves it through engineering cause-and-effect
- every sentence advances new information
- no fabricated measurements or decisive technical errors appear

## CLEAN

Confirm that:

- no infographic, text, or number appears
- geometry and materials remain consistent
- depth exists for later camera movement
- physical phenomena look realistic

## INFO

Confirm that:

- the underlying CLEAN camera and scene remain unchanged
- graphics are integrated into 3D scene space instead of acting like a flat HUD
- arrows and callout lines are anchored to real physical locations
- there is no oversized title unnecessarily repeating narration
- only small labels and critical values remain

## VIDEO

Confirm that:

- the clip begins from CLEAN
- graphics construct progressively
- camera and graphics move independently
- perspective, parallax, and occlusion remain stable
- forces and flows move in the correct physical direction
- the final INFO state is readable

## FILES

Confirm that:

- narration, CLEAN, INFO, and MP4 assets share correct IDs
- no numeric sequence is missing or duplicated
- alphabetical filename order equals narration order
- originals were not overwritten or accidentally deleted

---

# N. FAST EXECUTION MAP

```text
Attach this workflow to a new Codex session
→ provide topic and target duration
→ research and script
→ approve script
→ generate TTS
→ record actual TTS duration
→ finalize scene map and IDs
→ write CLEAN prompts
→ generate CLEAN assets externally
→ review CLEAN assets visually
→ write INFO second-pass prompts
→ generate INFO edits from matching CLEAN assets
→ review CLEAN–INFO pairs
→ write 4-second CLEAN-to-INFO video prompts
→ generate clips externally
→ review MP4 content and ordering
→ edit in Premiere Pro or another NLE
→ generate title and description
```

The invariant production chain is:

```text
SCRIPT
→ CLEAN
→ INFO
→ VIDEO
```

Do not sacrifice the following for speed:

- approval gates
- visual inspection
- one-to-one asset mapping
- stable IDs
- physical accuracy
- continuity between CLEAN and INFO
- correct CLEAN-to-INFO animation direction

---

# O. COMPLETION RULES

A stage is complete only when its required file exists, the output has been reviewed, and the relevant IDs match the project manifest.

Do not infer completion from filenames alone.

When a defect affects only one asset, repair only that asset.

Do not restart the full pipeline unless the user explicitly asks for a full rebuild.

For any uncertain engineering measurement or important factual claim, prefer official or reliable primary references.

Generated structures, aircraft, machinery, and internal mechanisms may contain visual inaccuracies and must be reviewed before publication.

External model capabilities, prices, limits, and product names may change over time.

Copyright, licensing, trademarks, music usage, image usage, and third-party asset rights must be checked separately before publication.

---

# P. PROJECT STATUS HANDOFF

At the end of any completed stage, update:

```text
manifests/PROJECT_STATUS.md
```

The status file should contain:

```text
Project:
Topic:
Target duration:
Actual TTS duration:
Current approved stage:
Last completed asset ID:
Next required stage:
Known defects:
Regeneration required:
Pending user approval:
```

When the project is reopened in a new session, inspect this status file together with the actual folders and manifests before continuing.

The project must always resume from the latest verified state, not from assumptions.

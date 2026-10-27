// The construction scene. Wires components + systems together and runs the mission flow:
//   intro -> missions 1-3 -> stage checkpoint -> missions 4-6 -> final construction
//   -> bridge load test -> Structural Report -> replay
// Missions swap in-scene (no reload) so the bridge visibly grows. Nothing here is specific
// to a triangle type: everything comes from mission data.

import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config/theme.js';
import { Environment } from '../components/Environment.js';
import { BridgeView } from '../components/BridgeView.js';
import { Crane } from '../components/Crane.js';
import { InventoryTray } from '../components/InventoryTray.js';
import { MissionPanel } from '../ui/MissionPanel.js';
import { ProgressPanel } from '../ui/ProgressPanel.js';
import { CraneControls } from '../ui/CraneControls.js';
import { ReinforcementCard } from '../ui/ReinforcementCard.js';
import { Banner } from '../ui/Banner.js';
import { IntroOverlay } from '../ui/IntroOverlay.js';
import { StructuralReport } from '../ui/StructuralReport.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { FxSystem } from '../systems/FxSystem.js';
import { getGameState, resetGameState } from '../systems/GameState.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { ScoringSystem } from '../systems/ScoringSystem.js';
import { HintSystem } from '../systems/HintSystem.js';
import { FeedbackSystem } from '../systems/FeedbackSystem.js';
import { PlacementSystem } from '../systems/PlacementSystem.js';
import { CheckpointSystem } from '../systems/CheckpointSystem.js';
import { FinaleSystem } from '../systems/FinaleSystem.js';
import { wait } from '../utils/async.js';
import { voice } from '../voice.js';
import { Narrator } from '../systems/Narrator.js';
import { VO_LINES } from '../vo_lines.js';

export class BuildScene extends Phaser.Scene {
  constructor() {
    super('Build');
  }

  create() {
    this.state = getGameState(this.game);
    this.scoring = this.registry.get('scoring') ?? new ScoringSystem();
    this.registry.set('scoring', this.scoring);
    this.missions = new MissionSystem(this.state);
    this.phase = 'boot';

    this.audio = new AudioSystem(this);
    this.env = new Environment(this);
    this.bridge = new BridgeView(this);
    this.state.completedStages.forEach((s) => this.bridge.buildInstant(s));
    this.crane = new Crane(this, this.audio);
    this.fx = new FxSystem(this);

    this.missionPanel = new MissionPanel(this);
    this.progress = new ProgressPanel(this, { total: this.missions.total, completed: this.missions.completedCount });
    this.card = new ReinforcementCard(this);
    this.banner = new Banner(this);
    this.controls = new CraneControls(this, { audio: this.audio, onPress: (mode) => this.onControl(mode) });
    // hide HUD until the briefing is dismissed
    [this.missionPanel.root, this.progress.root, this.controls.root].forEach((r) => r.setAlpha(0));

    this.hints = new HintSystem({ missionPanel: this.missionPanel, scoring: this.scoring });
    this.feedback = new FeedbackSystem(this, {
      crane: this.crane,
      bridge: this.bridge,
      progress: this.progress,
      card: this.card,
      fx: this.fx,
      audio: this.audio,
      hints: this.hints,
    });
    this.placement = new PlacementSystem(this, {
      crane: this.crane,
      bridge: this.bridge,
      controls: this.controls,
      missions: this.missions,
      scoring: this.scoring,
      feedback: this.feedback,
      audio: this.audio,
    });
    this.checkpoint = new CheckpointSystem(this, { bridge: this.bridge, banner: this.banner, audio: this.audio });
    this.finale = new FinaleSystem(this, {
      bridge: this.bridge,
      crane: this.crane,
      env: this.env,
      banner: this.banner,
      audio: this.audio,
      fx: this.fx,
      hud: { missionPanel: this.missionPanel, progress: this.progress, controls: this.controls },
    });

    this.slotZone = this.add.zone(0, 0, 150, 120).setInteractive({ useHandCursor: true });
    this.slotZone.on('pointerup', () => this.placement.state === 'selected' && this.placement.confirm());
    this.events.on('mission:complete', this.onMissionComplete, this);
    // guidance when a click would otherwise do nothing (no frame selected yet)
    this.controls.onDisabledPress = (mode) => mode === 'place' && this.placement.state === 'idle' && this.inventory?.nudge();
    this.input.on('pointerdown', (pointer, over) => {
      if (!over.length && this.phase === 'mission' && this.placement.state === 'idle') this.inventory?.nudge();
    });
    this.bindKeys();
    this.exposeQaHooks();

    // music + ambience duck under the voice-over
    const duckOn = () => this.audio.duck(true);
    const duckOff = () => this.audio.duck(false);
    voice.on('start', duckOn);
    voice.on('end', duckOff);
    this.events.once('shutdown', () => {
      Narrator.stop();
      voice.off('start', duckOn);
      voice.off('end', duckOff);
    });

    this.cameras.main.fadeIn(420, 13, 27, 43);
    this.begin();
  }

  async begin() {
    if (!this.registry.get('introSeen')) {
      await wait(this, 300);
      this.phase = 'intro';
      await new IntroOverlay(this, { onBegin: () => this.startVoice() }).show();
      this.registry.set('introSeen', true);
    }
    this.startVoice();
    this.audio.startAmbience();
    this.phase = 'mission';
    this.missionPanel.setMission(this.missions.current);
    await Promise.all([this.missionPanel.enter(), this.progress.enter(), this.controls.enter()]);
    this.missionPanel.narrateInstruction();
    await this.loadMission(this.missions.current, { first: true });
  }

  /** Bring the next requirement + yard in, keeping the crane, bridge and world in place. */
  async loadMission(mission, { first = false } = {}) {
    this.mission = mission;
    this.hints.reset();
    this.placement.lock();
    if (!first) {
      await this.missionPanel.swapMission(mission);
      this.missionPanel.narrateInstruction();
    }

    this.inventory?.destroy(this.lastPlacedFrame);
    this.inventory = new InventoryTray(this, {
      frames: this.missions.optionsFor(mission),
      markings: mission.markings,
      audio: this.audio,
      onSelect: (i) => this.placement.select(i),
    });
    this.hints.setInventory(this.inventory);
    this.feedback.setInventory(this.inventory);
    this.placement.setMission(mission, this.inventory);

    this.bridge.showSlot(mission.slotPanel);
    const { marker } = this.bridge.slotWorld();
    this.slotZone.setPosition(marker.x, marker.y);
    this.controls.setMode('place', false);
    this.crane.moveTrolleyTo(this.crane.layout.restTrolleyX, { audio: this.audio });
    this.crane.ropeToTipY(this.crane.trolleyY + 200, { duration: 500 });

    await this.inventory.enter();
    this.placement.start();
    this.events.emit('ready', { mission: mission.id });
    // first-time guidance if nothing is picked after a few seconds
    this.time.delayedCall(4500, () => {
      if (this.mission === mission && this.placement.state === 'idle' && this.inventory?.selected < 0) this.inventory.nudge();
    });
  }

  async onMissionComplete({ frame }) {
    this.lastPlacedFrame = frame;
    if (this.missions.allComplete) {
      // the last frame is in: let the reinforcement land, then build out the bridge
      await wait(this, 2200);
      await this.card.hide();
      await this.runFinale();
      return;
    }
    this.controls.setMode('next', true);
  }

  bindKeys() {
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.phase === 'mission' && this.placement.cycle(-1));
    kb.on('keydown-RIGHT', () => this.phase === 'mission' && this.placement.cycle(1));
    const go = () => {
      if (this.phase === 'mission' && this.controls.enabled) this.onControl(this.controls.mode);
    };
    kb.on('keydown-ENTER', go);
    kb.on('keydown-SPACE', go);
  }

  onControl(mode) {
    if (mode === 'place') this.placement.confirm();
    else if (mode === 'next') this.continue();
  }

  async continue() {
    this.controls.setEnabled(false);
    const done = this.mission;
    await this.card.hide();
    this.lastPlacedFrame?.setLabelsVisible(false);
    if (done.checkpoint) {
      this.phase = 'checkpoint';
      await this.checkpoint.run(done.checkpoint);
      this.phase = 'mission';
    }
    const next = this.missions.next();
    if (next) await this.loadMission(next);
  }

  async runFinale() {
    this.phase = 'finale';
    this.placement.lock();
    this.inventory?.destroy(this.lastPlacedFrame);
    this.inventory = null;
    await this.finale.finalConstruction();
    this.phase = 'test';
    await this.finale.bridgeTest();
    this.phase = 'report';
    this.report = new StructuralReport(this, {
      scoring: this.scoring,
      missionsTotal: this.missions.total,
      audio: this.audio,
      onReplay: () => this.replay(),
    });
    await this.report.show();
    this.events.emit('report:shown');
  }

  /** First user gesture: unlock the voice, then quietly prefetch every clip in order. */
  startVoice() {
    voice.unlock();
    if (this.registry.get('voPrefetched')) return;
    this.registry.set('voPrefetched', true);
    const ids = [...new Set(Object.values(VO_LINES).map((v) => v[0]))].sort();
    voice.prefetch(ids);
  }

  replay() {
    Narrator.stop();
    resetGameState(this.game);
    this.registry.set('scoring', new ScoringSystem());
    this.audio.stopAmbience(true);
    this.cameras.main.fadeOut(320, 13, 27, 43);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
  }

  /** Read-mostly hooks used by scripts/qa-run.mjs. */
  exposeQaHooks() {
    const scene = this;
    window.__bridge = {
      scene,
      get phase() {
        return scene.phase;
      },
      get placement() {
        return scene.placement;
      },
      get missions() {
        return scene.missions;
      },
      get scoring() {
        return scene.scoring;
      },
      get mission() {
        return scene.mission;
      },
      frameZones: () => scene.inventory?.slots.map((s, i) => scene.inventory.zoneCentre(i)) ?? [],
      correctIndex: () => scene.inventory?.slots.findIndex((s) => scene.missions.evaluate(s.id, scene.mission).correct) ?? -1,
      controlsButton: () => ({ x: scene.controls.home.x + scene.controls.btn.x, y: scene.controls.home.y + scene.controls.btn.y }),
      width: GAME_WIDTH,
      colors: COLORS,
    };
  }
}

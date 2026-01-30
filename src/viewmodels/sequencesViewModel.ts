import { createId } from "../core/id.js";
import type { AppState, Sequence, SequenceStep } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort } from "../services/types.js";
import type { SequencesViewPort } from "./ports.js";

export class SequencesViewModel {
  private store: Store<AppState>;
  private sequencesView: SequencesViewPort;
  private persist: () => void;
  private updateParamUI: () => void;
  private bluetoothService: BluetoothServicePort;

  constructor(options: {
    store: Store<AppState>;
    sequencesView: SequencesViewPort;
    persist: () => void;
    updateParamUI: () => void;
    bluetoothService: BluetoothServicePort;
  }) {
    this.store = options.store;
    this.sequencesView = options.sequencesView;
    this.persist = options.persist;
    this.updateParamUI = options.updateParamUI;
    this.bluetoothService = options.bluetoothService;
  }

  private get state() {
    return this.store.getState();
  }

  renderSequences() {
    this.sequencesView.render({
      sequences: this.state.sequences,
      selectedSequenceId: this.state.selectedSequenceId,
      playback: this.state.playback,
      sequenceSync: this.state.sequenceSync,
      connection: this.state.connection
    });
  }

  handleNewSequence() {
    const newSequence: Sequence = {
      id: createId("sequence"),
      name: `Sequence ${this.state.sequences.length + 1}`,
      steps: [
        { duration: 10, freq: 5, amp: 40, noise: 10 },
        { duration: 10, freq: 6, amp: 50, noise: 12 }
      ]
    };
    this.store.update((state) => {
      state.sequences.unshift(newSequence);
      state.selectedSequenceId = newSequence.id;
    });
    this.persist();
  }

  handleListAction(action: string, id: string) {
    const sequence = this.state.sequences.find((item) => item.id === id);
    if (!sequence) return;

    if (action === "edit") {
      this.store.update((state) => {
        state.selectedSequenceId = id;
      });
    }
    if (action === "play") {
      this.store.update((state) => {
        state.selectedSequenceId = id;
      });
      this.startSequencePlayback(id);
    }
    if (action === "duplicate") {
      const copy: Sequence = {
        ...sequence,
        id: createId("sequence"),
        name: `${sequence.name} (Copy)`,
        steps: sequence.steps.map((step) => ({ ...step }))
      };
      this.store.update((state) => {
        state.sequences.unshift(copy);
        state.selectedSequenceId = copy.id;
      });
    }
    if (action === "delete") {
      this.store.update((state) => {
        state.sequences = state.sequences.filter((item) => item.id !== id);
        if (state.selectedSequenceId === id) {
          state.selectedSequenceId = null;
        }
      });
      if (this.state.playback.seqId === id) {
        this.stopSequencePlayback();
      }
    }
    this.persist();
  }

  handleEditorInput(payload: { field?: string; index?: number; value?: string }) {
    const sequence = this.state.sequences.find((seq) => seq.id === this.state.selectedSequenceId);
    if (!sequence) return;

    if (payload.field === "sequenceName") {
      this.store.update(() => {
        sequence.name = payload.value ?? "";
      });
      this.persist();
      return;
    }

    const field = payload.field;
    const index = payload.index;
    if (!field || index === undefined) return;
    const step = sequence.steps[index];
    if (!step) return;
    this.store.update(() => {
      (step as SequenceStep)[field as keyof SequenceStep] = Number(payload.value);
    });
    this.persist();
  }

  handleEditorAction(payload: { action: string; index?: number }) {
    const sequence = this.state.sequences.find((seq) => seq.id === this.state.selectedSequenceId);
    if (!sequence) return;

    if (payload.action === "add-step") {
      this.store.update(() => {
        sequence.steps.push({ duration: 10, freq: 5, amp: 40, noise: 10 });
      });
      this.persist();
      return;
    }

    const index = payload.index ?? -1;
    if (payload.action === "up" && index > 0) {
      this.store.update(() => {
        [sequence.steps[index - 1], sequence.steps[index]] = [
          sequence.steps[index],
          sequence.steps[index - 1]
        ];
      });
    }
    if (payload.action === "down" && index < sequence.steps.length - 1) {
      this.store.update(() => {
        [sequence.steps[index + 1], sequence.steps[index]] = [
          sequence.steps[index],
          sequence.steps[index + 1]
        ];
      });
    }
    if (payload.action === "remove") {
      this.store.update(() => {
        sequence.steps.splice(index, 1);
      });
    }
    if (payload.action === "seq-play") {
      this.startSequencePlayback(sequence.id);
    }
    if (payload.action === "seq-pause") {
      this.pauseSequencePlayback();
    }
    if (payload.action === "seq-stop") {
      this.stopSequencePlayback();
    }
    if (payload.action === "device-sync") {
      void this.syncSequenceToDevice(sequence);
    }
    if (payload.action === "device-play") {
      void this.playSequenceOnDevice(sequence);
    }
    if (payload.action === "device-stop") {
      void this.stopSequenceOnDevice();
    }
    this.persist();
  }

  private startSequencePlayback(sequenceId: string) {
    const sequence = this.state.sequences.find((seq) => seq.id === sequenceId);
    if (!sequence || sequence.steps.length === 0) return;
    if (this.state.playback.seqId === sequenceId && !this.state.playback.playing) {
      this.store.update((state) => {
        state.playback.playing = true;
      });
      return;
    }
    this.stopSequencePlayback();
    this.store.update((state) => {
      state.playback.seqId = sequenceId;
      state.playback.stepIndex = 0;
      state.playback.elapsed = 0;
      state.playback.playing = true;
    });
    this.applyStep(sequence.steps[0]);
    this.store.update((state) => {
      state.playback.intervalId = window.setInterval(() => {
        if (!state.playback.playing) return;
        const currentStep = sequence.steps[state.playback.stepIndex];
        state.playback.elapsed += 0.2;
        if (state.playback.elapsed >= currentStep.duration) {
          state.playback.stepIndex += 1;
          state.playback.elapsed = 0;
          if (state.playback.stepIndex >= sequence.steps.length) {
            this.stopSequencePlayback();
            return;
          }
          this.applyStep(sequence.steps[state.playback.stepIndex]);
        }
      }, 200);
    });
  }

  private pauseSequencePlayback() {
    if (!this.state.playback.intervalId) return;
    this.store.update((state) => {
      state.playback.playing = false;
    });
  }

  private stopSequencePlayback() {
    if (this.state.playback.intervalId) {
      clearInterval(this.state.playback.intervalId);
    }
    this.store.update((state) => {
      state.playback.intervalId = null;
      state.playback.seqId = null;
      state.playback.playing = false;
      state.playback.stepIndex = 0;
      state.playback.elapsed = 0;
    });
  }

  private applyStep(step: { freq: number; amp: number; noise: number }) {
    this.store.update((state) => {
      state.params.freq = step.freq;
      state.params.amp = step.amp;
      state.params.noise = step.noise;
      state.params.enabled = true;
    });
    this.updateParamUI();
  }

  private async syncSequenceToDevice(sequence: Sequence) {
    if (!sequence) return;
    if (this.state.connection.mode !== "bluetooth" || this.state.connection.status !== "connected") {
      window.alert("Connect to a Bluetooth device before syncing sequences.");
      return;
    }
    await this.bluetoothService.sendCommand({
      type: "sequence-save",
      sequence: {
        id: sequence.id,
        name: sequence.name,
        steps: sequence.steps
      }
    });
    const now = new Date();
    this.store.update((state) => {
      state.sequenceSync[sequence.id] = {
        syncedAt: now.toISOString().slice(0, 19).replace("T", " ")
      };
    });
  }

  private async playSequenceOnDevice(sequence: Sequence) {
    if (!sequence) return;
    if (this.state.connection.mode !== "bluetooth" || this.state.connection.status !== "connected") {
      window.alert("Connect to a Bluetooth device before playing sequences.");
      return;
    }
    await this.bluetoothService.sendCommand({ type: "sequence-play", id: sequence.id });
  }

  private async stopSequenceOnDevice() {
    if (this.state.connection.mode !== "bluetooth" || this.state.connection.status !== "connected") {
      window.alert("Connect to a Bluetooth device before stopping sequences.");
      return;
    }
    await this.bluetoothService.sendCommand({ type: "sequence-stop" });
  }
}

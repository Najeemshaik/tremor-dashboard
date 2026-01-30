import type { AppState, ConnectionState, Sequence } from "../state/types.js";
import type { Elements } from "../ui/elements.js";

export class SequencesView {
  private elements: Elements;
  private onNewSequence: () => void;
  private onListAction: (action: string, id: string) => void;
  private onEditorInput: (payload: {
    field?: string;
    index?: number;
    value?: string;
    sequenceId?: string | null;
  }) => void;
  private onEditorAction: (payload: {
    action: string;
    index?: number;
    sequenceId?: string | null;
  }) => void;

  constructor(options: {
    elements: Elements;
    onNewSequence: () => void;
    onListAction: (action: string, id: string) => void;
    onEditorInput: (payload: {
      field?: string;
      index?: number;
      value?: string;
      sequenceId?: string | null;
    }) => void;
    onEditorAction: (payload: {
      action: string;
      index?: number;
      sequenceId?: string | null;
    }) => void;
  }) {
    this.elements = options.elements;
    this.onNewSequence = options.onNewSequence;
    this.onListAction = options.onListAction;
    this.onEditorInput = options.onEditorInput;
    this.onEditorAction = options.onEditorAction;
  }

  render(options: {
    sequences: Sequence[];
    selectedSequenceId: string | null;
    playback: AppState["playback"];
    sequenceSync: AppState["sequenceSync"];
    connection: ConnectionState;
  }) {
    this.elements.sequenceList.innerHTML = "";
    if (options.sequences.length === 0) {
      this.elements.sequencesEmpty.classList.remove("hidden");
    } else {
      this.elements.sequencesEmpty.classList.add("hidden");
    }

    options.sequences.forEach((sequence: Sequence, index: number) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.setAttribute("role", "listitem");
      item.style.animationDelay = `${index * 0.05}s`;
      if (sequence.id === options.selectedSequenceId) {
        item.classList.add("active");
      }
      const totalDuration = sequence.steps.reduce(
        (sum, step) => sum + Number(step.duration || 0),
        0
      );
      item.innerHTML = `
        <div>
          <div class="list-title">${sequence.name}</div>
          <div class="list-sub">${sequence.steps.length} steps &middot; ${totalDuration}s total</div>
        </div>
        <div class="list-actions">
          <button class="btn btn-ghost" data-action="edit" data-id="${sequence.id}" aria-label="Edit sequence ${sequence.name}">Edit</button>
          <button class="btn btn-secondary" data-action="play" data-id="${sequence.id}" aria-label="Play sequence ${sequence.name}">Play</button>
          <button class="btn btn-danger" data-action="delete" data-id="${sequence.id}" aria-label="Delete sequence ${sequence.name}">Delete</button>
        </div>
      `;
      this.elements.sequenceList.appendChild(item);
    });

    this.renderEditor({
      sequences: options.sequences,
      selectedSequenceId: options.selectedSequenceId,
      playback: options.playback,
      sequenceSync: options.sequenceSync,
      connection: options.connection
    });
  }

  renderEditor(options: {
    sequences: Sequence[];
    selectedSequenceId: string | null;
    playback: AppState["playback"];
    sequenceSync: AppState["sequenceSync"];
    connection: ConnectionState;
  }) {
    const sequence = options.sequences.find((seq) => seq.id === options.selectedSequenceId);
    if (!sequence) {
      this.elements.sequenceEditor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <h3>No Sequence Selected</h3>
          <p>Choose a sequence from the library to view and edit its steps.</p>
        </div>
      `;
      return;
    }

    const stepsHtml = sequence.steps
      .map((step, index) => {
        return `
          <div class="step-row" data-index="${index}" style="animation-delay: ${index * 0.05}s">
            <input type="number" min="1" step="1" value="${step.duration}" data-field="duration" data-index="${index}" placeholder="Duration" aria-label="Step ${index + 1} duration in seconds" />
            <input type="number" min="4" max="12" step="1" value="${step.freq}" data-field="freq" data-index="${index}" placeholder="Freq" aria-label="Step ${index + 1} frequency in hertz" />
            <input type="number" min="0" max="100" step="1" value="${step.amp}" data-field="amp" data-index="${index}" placeholder="Amp" aria-label="Step ${index + 1} amplitude" />
            <input type="number" min="0" max="100" step="1" value="${step.noise}" data-field="noise" data-index="${index}" placeholder="Noise" aria-label="Step ${index + 1} noise level" />
            <div class="step-actions">
              <button class="btn btn-ghost" data-action="up" data-index="${index}" aria-label="Move step ${index + 1} up">↑</button>
              <button class="btn btn-ghost" data-action="down" data-index="${index}" aria-label="Move step ${index + 1} down">↓</button>
              <button class="btn btn-danger" data-action="remove" data-index="${index}" aria-label="Remove step ${index + 1}">×</button>
            </div>
          </div>
        `;
      })
      .join("");

    let statusText = "Stopped";
    let statusClass = "";
    if (options.playback.seqId === sequence.id) {
      const playbackState = options.playback;
      const stepNumber = playbackState.stepIndex + 1;
      const step = sequence.steps[playbackState.stepIndex];
      const remaining = step ? Math.max(0, Math.round(step.duration - playbackState.elapsed)) : 0;
      statusText = playbackState.playing
        ? `Playing Step ${stepNumber}/${sequence.steps.length} — ${remaining}s remaining`
        : `Paused at Step ${stepNumber} — ${remaining}s remaining`;
      statusClass = playbackState.playing ? "recording" : "";
    }

    const syncInfo = options.sequenceSync[sequence.id];
    const syncText = syncInfo ? `Synced ${syncInfo.syncedAt}` : "Not synced";
    const deviceButtonsDisabled =
      options.connection.mode !== "bluetooth" || options.connection.status !== "connected"
        ? "disabled"
        : "";

    this.elements.sequenceEditor.innerHTML = `
      <div class="sequence-editor">
        <div class="field">
          <label for="sequenceName">Sequence Name</label>
          <input type="text" id="sequenceName" value="${sequence.name}" />
        </div>
        <div class="step-row" style="background: transparent; border: none; padding: 0 12px;">
          <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Duration (s)</div>
          <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Freq (Hz)</div>
          <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Amplitude</div>
          <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Noise</div>
          <div></div>
        </div>
        ${stepsHtml}
        <button class="btn btn-secondary" id="addStepBtn">
          <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Step
        </button>
        <div class="sequence-status ${statusClass}">
          <div>
            <div class="label">Playback Status</div>
            <div class="muted" id="sequenceStatus">${statusText}</div>
          </div>
          <div class="button-row" style="margin-top: 0;">
            <button class="btn btn-primary" data-action="seq-play">
              <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Play
            </button>
            <button class="btn btn-secondary" data-action="seq-pause">
              <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            </button>
            <button class="btn btn-ghost" data-action="seq-stop">Stop</button>
          </div>
        </div>
        <div class="sequence-status">
          <div>
            <div class="label">Device Sync</div>
            <div class="muted" id="deviceSyncStatus">${syncText}</div>
          </div>
          <div class="button-row" style="margin-top: 0;">
            <button class="btn btn-secondary" data-action="device-sync" ${deviceButtonsDisabled}>Sync to Device</button>
            <button class="btn btn-primary" data-action="device-play" ${deviceButtonsDisabled}>Play on Device</button>
            <button class="btn btn-ghost" data-action="device-stop" ${deviceButtonsDisabled}>Stop Device</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.elements.newSequenceBtn.addEventListener("click", () => {
      this.onNewSequence();
    });

    this.elements.sequenceList.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      this.onListAction(action, id);
    });

    this.elements.sequenceEditor.addEventListener("input", (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.id === "sequenceName") {
        this.onEditorInput({ field: "sequenceName", value: target.value });
        return;
      }
      const field = target.dataset.field;
      const index = Number(target.dataset.index);
      this.onEditorInput({
        field: field || undefined,
        index: Number.isNaN(index) ? undefined : index,
        value: target.value
      });
    });

    this.elements.sequenceEditor.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.id === "addStepBtn" || target.closest("#addStepBtn")) {
        this.onEditorAction({ action: "add-step" });
        return;
      }

      const action = target.dataset.action;
      const index = Number(target.dataset.index);
      if (!action) return;
      this.onEditorAction({
        action,
        index: Number.isNaN(index) ? undefined : index
      });
    });
  }
}

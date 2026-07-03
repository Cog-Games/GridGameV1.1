(() => {
  const socket = io();

  const els = {
    joinBtn: document.getElementById('joinBtn'),
    readyBtn: document.getElementById('readyBtn'),
    status: document.getElementById('status'),
    room: document.getElementById('room'),
    trial: document.getElementById('trial'),
    canvas: document.getElementById('gameCanvas'),
    feedback: document.getElementById('feedback'),
    controls: document.getElementById('controls'),
    survey: document.getElementById('survey'),
    surveyForm: document.getElementById('surveyForm'),
    thanks: document.getElementById('thanks'),
  };

  const ctx = els.canvas.getContext('2d');

  let state = {
    playerId: null,
    role: null,
    roomId: null,
    gameState: null,
    connected: false,
    joined: false,
    ready: false,
    gameEnded: false,
  };

  function setStatus(text) {
    els.status.textContent = text;
  }

  function setFeedback(text, className = '') {
    els.feedback.textContent = text;
    els.feedback.className = className;
  }

  function myPlayer() {
    if (!state.gameState || !state.playerId) return null;
    return state.gameState.players[state.playerId] || null;
  }

  function partnerPlayer() {
    if (!state.gameState || !state.playerId) return null;
    return Object.entries(state.gameState.players)
      .filter(([id]) => id !== state.playerId)
      .map(([, player]) => player)[0] || null;
  }

  function canMove() {
    const me = myPlayer();
    return Boolean(state.gameState && me && !me.finished && !state.gameState.trialComplete && !state.gameEnded);
  }

  function updateHeader() {
    els.room.textContent = state.roomId ? `Room: ${state.roomId}` : 'Room: not joined';
    if (state.gameState) {
      els.trial.textContent = `Round ${state.gameState.trialIndex + 1} / ${state.gameState.maxTrials}`;
    } else {
      els.trial.textContent = 'Round 0 / 4';
    }
  }

  function resizeCanvas() {
    const maxByWidth = window.innerWidth * 0.92;
    const maxByHeight = window.innerHeight * 0.52;
    const size = Math.floor(Math.min(maxByWidth, maxByHeight, 430));
    const dpr = window.devicePixelRatio || 1;
    els.canvas.style.width = `${size}px`;
    els.canvas.style.height = `${size}px`;
    els.canvas.width = Math.floor(size * dpr);
    els.canvas.height = Math.floor(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function draw() {
    const visualSize = els.canvas.clientWidth || 360;
    ctx.clearRect(0, 0, visualSize, visualSize);

    const gridSize = state.gameState ? state.gameState.gridSize : 9;
    const cell = visualSize / gridSize;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(0, 0, visualSize, visualSize, 18);
    ctx.fill();

    ctx.strokeStyle = '#d6dbe1';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i += 1) {
      const p = i * cell;
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(visualSize, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, visualSize);
      ctx.stroke();
    }

    if (!state.gameState) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Join with two phones to start', visualSize / 2, visualSize / 2);
      return;
    }

    state.gameState.goals.forEach((goal, index) => {
      const [row, col] = goal;
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.31, 0, Math.PI * 2);
      ctx.fillStyle = index < 2 ? '#2563eb' : '#16a34a';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(13, cell * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`G${index + 1}`, cx, cy);
    });

    Object.entries(state.gameState.players).forEach(([id, player]) => {
      const [row, col] = player.position;
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      const isMe = id === state.playerId;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = isMe ? '#dc2626' : '#f97316';
      ctx.fill();
      ctx.lineWidth = isMe ? 4 : 2;
      ctx.strokeStyle = '#111827';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, cell * 0.30)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isMe ? 'You' : 'P', cx, cy);

      if (player.finished) {
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.43, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }

  function sendMove(action) {
    if (!canMove()) return;
    socket.emit('make_move', { action, clientTimestamp: Date.now() });
  }

  function updateControlState() {
    const enabled = canMove();
    els.controls.querySelectorAll('button[data-action]').forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function renderAll() {
    updateHeader();
    updateControlState();
    draw();
  }

  els.joinBtn.addEventListener('click', () => {
    els.joinBtn.disabled = true;
    setStatus('Joining mobile 2P3G game...');
    socket.emit('join_mobile_game');
  });

  els.readyBtn.addEventListener('click', () => {
    els.readyBtn.disabled = true;
    state.ready = true;
    setStatus('Ready. Waiting for partner...');
    socket.emit('player_ready');
  });

  els.controls.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      sendMove(button.dataset.action);
    });
  });

  window.addEventListener('keydown', (event) => {
    const keyToAction = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    };
    const action = keyToAction[event.code];
    if (action) {
      event.preventDefault();
      sendMove(action);
    }
  });

  els.surveyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(els.surveyForm);
    const responses = {
      sharedGoalFeeling: Number(form.get('sharedGoalFeeling')),
      partnerUnderstanding: Number(form.get('partnerUnderstanding')),
      coordinationStrategy: String(form.get('coordinationStrategy') || '').trim(),
    };
    socket.emit('survey_submit', {
      roomId: state.roomId,
      playerId: state.playerId,
      role: state.role,
      responses,
      clientTimestamp: Date.now(),
    });
    els.surveyForm.querySelector('button[type="submit"]').disabled = true;
    setStatus('Saving responses...');
  });

  socket.on('connect', () => {
    state.connected = true;
    setStatus('Connected. Tap Join Game on both phones.');
  });

  socket.on('disconnect', () => {
    state.connected = false;
    setStatus('Disconnected. Please refresh the page.');
    updateControlState();
  });

  socket.on('joined_room', (data) => {
    state.playerId = data.playerId;
    state.role = data.role;
    state.roomId = data.roomId;
    state.joined = true;
    els.readyBtn.disabled = data.playerCount < data.maxPlayers;
    setStatus(data.playerCount < data.maxPlayers ? 'Waiting for another player...' : 'Partner joined. Tap Ready.');
    renderAll();
  });

  socket.on('players_changed', (data) => {
    if (!state.joined) return;
    els.readyBtn.disabled = state.ready || data.playerCount < data.maxPlayers;
    if (data.playerCount < data.maxPlayers) {
      setStatus('Waiting for another player...');
    } else if (!state.ready) {
      setStatus('Partner joined. Tap Ready.');
    }
    renderAll();
  });

  socket.on('room_full', () => {
    if (!state.ready) {
      els.readyBtn.disabled = false;
      setStatus('Both players connected. Tap Ready.');
    }
  });

  socket.on('trial_started', (data) => {
    state.gameState = data.gameState;
    state.gameEnded = false;
    els.survey.hidden = true;
    setFeedback('', '');
    setStatus(`Round ${data.trialIndex + 1} started. Use the touch arrows to move.`);
    renderAll();
  });

  socket.on('game_state_update', (data) => {
    if (!data.gameState || state.gameEnded) return;
    state.gameState = data.gameState;
    renderAll();
  });

  socket.on('move_made', (data) => {
    state.gameState = data.gameState;
    const me = myPlayer();
    const partner = partnerPlayer();
    if (me && me.finished && partner && !partner.finished) {
      setStatus('You reached a goal. Waiting for your partner.');
    }
    renderAll();
  });

  socket.on('new_goal_presented', (data) => {
    state.gameState = data.gameState;
    setFeedback('A new green goal appeared!', 'info');
    renderAll();
    setTimeout(() => {
      if (!state.gameEnded) setFeedback('', '');
    }, 1400);
  });

  socket.on('trial_complete', (data) => {
    state.gameState = data.gameState;
    const message = data.success ? 'Success: you reached the same goal.' : 'Different goals this round.';
    setFeedback(message, data.success ? 'success' : 'warning');
    setStatus(data.nextTrialStartsInMs ? 'Next round will start automatically.' : 'Game complete.');
    renderAll();
  });

  socket.on('game_ended', (summary) => {
    state.gameEnded = true;
    setStatus(`All 4 rounds complete. Successes: ${summary.successes} / ${summary.maxTrials}.`);
    els.controls.querySelectorAll('button[data-action]').forEach((button) => {
      button.disabled = true;
    });
    els.survey.hidden = false;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  socket.on('survey_saved', () => {
    els.survey.hidden = true;
    els.thanks.hidden = false;
    setStatus('Responses saved. Thank you.');
  });

  socket.on('partner_left', (data) => {
    state.gameEnded = true;
    setStatus(data.message || 'Your partner left. Please refresh to restart.');
    setFeedback('Session ended.', 'warning');
    updateControlState();
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  renderAll();
})();

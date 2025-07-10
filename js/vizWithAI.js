var ifPlayerShowInFixation = false;
var ifGoalShowInFixation = false;
var ifObstacleShowInFixation = false;
var ifAIShowInFixation = false;

function getCenter(w, h) {
    return {
        x: window.innerWidth / 2 - w / 2 + "px",
        y: window.innerHeight / 2 - h / 2 + "px"
    };
}

function drawGrid(c, currentGoals = null){
    var context = c.getContext("2d");
    c.width = WINSETTING.w;
    c.height = WINSETTING.h;

    c.style.marginLeft = 0;
    c.style.marginTop = 0;

    context.fillStyle = COLORPOOL.line;
    context.fillRect(0 - EXPSETTINGS.padding,
        0 - EXPSETTINGS.padding,
        WINSETTING.w + EXPSETTINGS.padding, WINSETTING.h + EXPSETTINGS.padding);

    // Get current player positions (if available)
    let humanPos = null;
    let aiPos = null;

    // Try to get positions from global variables if they exist
    if (typeof playerState !== 'undefined') {
        humanPos = playerState;
    }
    if (typeof aiState !== 'undefined') {
        aiPos = aiState;
    }

    // First pass: draw everything except goals and players
    for (let row = 0; row < gridMatrixList.length; row++) {
        for (let col = 0; col < gridMatrixList.length; col++) {
            const cellVal = gridMatrixList[row][col];
            let color = "#111";

            switch(cellVal) {
                case OBJECT.obstacle:
                    color = COLORPOOL.obstacle;
                    break;
                case OBJECT.goal:
                    // Skip goals in first pass
                    continue;
                default:
                    color = COLORPOOL.map;
            }

            // Draw squares for obstacles, skip players for now
            if (cellVal !== OBJECT.player && cellVal !== OBJECT.ai_player) {
                context.fillStyle = color;
                context.fillRect(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
            }
        }
    }

    // Second pass: draw players with overlap detection
    if (humanPos && aiPos) {
        // Check if players are in the same position
        if (humanPos[0] === aiPos[0] && humanPos[1] === aiPos[1]) {
            // Draw overlapping circles
            drawOverlappingCircles(context, humanPos[1], humanPos[0]);
        } else {
            // Draw separate circles
            drawCircle(context, COLORPOOL.player, 1/3 * EXPSETTINGS.padding,
                humanPos[1], humanPos[0], 0, 2 * Math.PI);
            drawCircle(context, "orange", 1/3 * EXPSETTINGS.padding,
                aiPos[1], aiPos[0], 0, 2 * Math.PI);
        }
    } else {
        // Fallback to original method if positions not available
        for (let row = 0; row < gridMatrixList.length; row++) {
            for (let col = 0; col < gridMatrixList.length; col++) {
                const cellVal = gridMatrixList[row][col];
                if (cellVal === OBJECT.player) {
                    drawCircle(context, COLORPOOL.player, 1/3 * EXPSETTINGS.padding,
                        col, row, 0, 2 * Math.PI);
                } else if (cellVal === OBJECT.ai_player) {
                    drawCircle(context, "orange", 1/3 * EXPSETTINGS.padding,
                        col, row, 0, 2 * Math.PI);
                }
            }
        }
    }

    // Second pass: draw goals on top (always visible)
    for (let row = 0; row < gridMatrixList.length; row++) {
        for (let col = 0; col < gridMatrixList.length; col++) {
            const cellVal = gridMatrixList[row][col];

            if (cellVal === OBJECT.goal) {
                // Draw goal as a semi-transparent overlay
                context.fillStyle = COLORPOOL.goal;
                context.globalAlpha = 0.7; // Make it semi-transparent
                context.fillRect(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
                context.globalAlpha = 1.0; // Reset transparency
            }
        }
    }

    // Third pass: ALWAYS draw goals at their intended positions (always visible)
    // This ensures goals are always shown even if they were overwritten in the matrix
    if (currentGoals && Array.isArray(currentGoals) && currentGoals.length >= 2) {
        context.fillStyle = COLORPOOL.goal;
        context.globalAlpha = 0.5; // Make it more transparent for overlay

        // Draw all goals (supports 2 or 3 goals)
        for (let i = 0; i < currentGoals.length; i++) {
            if (currentGoals[i] && Array.isArray(currentGoals[i]) && currentGoals[i].length >= 2) {
                context.fillRect(currentGoals[i][1] * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    currentGoals[i][0] * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
            }
        }

        context.globalAlpha = 1.0; // Reset transparency
    }
}

function drawCircle(c, color, lineWidth, colPos, rowPos, startAngle, tmpAngle) {
    // First draw white background
    c.fillStyle = COLORPOOL.map;
    c.fillRect(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);

    const circleRadius = EXPSETTINGS.cellSize * 0.4; // Make circles 30% of cell size

    // Then draw circle
    c.beginPath();
    c.lineWidth = lineWidth;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.arc(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2,
        circleRadius,
        startAngle, tmpAngle);
    c.fill();
    c.stroke();
}

function drawOverlappingCircles(c, colPos, rowPos) {
    // First draw white background
    c.fillStyle = COLORPOOL.map;
    c.fillRect(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);

    const circleRadius = EXPSETTINGS.cellSize * 0.35; // Slightly smaller for overlap
    const centerX = colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2;
    const centerY = rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2;
    const offset = EXPSETTINGS.cellSize * 0.15; // Offset for overlap

    // Draw human player circle (red) on the left
    c.beginPath();
    c.lineWidth = 1/3 * EXPSETTINGS.padding;
    c.strokeStyle = COLORPOOL.player;
    c.fillStyle = COLORPOOL.player;
    c.arc(centerX - offset, centerY, circleRadius, 0, 2 * Math.PI);
    c.fill();
    c.stroke();

    // Draw AI player circle (orange) on the right
    c.beginPath();
    c.strokeStyle = "orange";
    c.fillStyle = "orange";
    c.arc(centerX + offset, centerY, circleRadius, 0, 2 * Math.PI);
    c.fill();
    c.stroke();
}

function fixation(c) {
    var context = c.getContext("2d");
    c.width = WINSETTING.w;
    c.height = WINSETTING.h;

    c.style.marginLeft = 0;
    c.style.marginTop = 0;

    context.fillStyle = COLORPOOL.line;
    context.fillRect(0 - EXPSETTINGS.padding,
        0 - EXPSETTINGS.padding,
        WINSETTING.w + EXPSETTINGS.padding, WINSETTING.h + EXPSETTINGS.padding);

    for (let row = 0; row < gridMatrixList.length; row++) {
        for (let col = 0; col < gridMatrixList.length; col++) {
            const cellVal = gridMatrixList[row][col];
            let color = "#111";
            let shouldShow = false;

            switch(cellVal) {
                case OBJECT.obstacle:
                    color = COLORPOOL.obstacle;
                    shouldShow = ifObstacleShowInFixation;
                    break;
                case OBJECT.player:
                    color = COLORPOOL.player;
                    shouldShow = ifPlayerShowInFixation;
                    break;
                case OBJECT.ai_player:
                    color = COLORPOOL.ai_player;
                    shouldShow = ifAIShowInFixation;
                    break;
                case OBJECT.goal:
                    color = COLORPOOL.goal;
                    shouldShow = ifGoalShowInFixation;
                    break;
                default:
                    color = COLORPOOL.map;
                    shouldShow = true;
            }

            if (!shouldShow) {
                color = COLORPOOL.map;
            }

            if (shouldShow && cellVal === OBJECT.goal) {
                context.fillStyle = color;
                context.fillRect(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
            } else if (shouldShow && (cellVal === OBJECT.player || cellVal === OBJECT.ai_player)) {
                drawCircle(context, color, 1/3 * EXPSETTINGS.padding,
                    col, row, 0, 2 * Math.PI);
            } else {
                context.fillStyle = color;
                context.fillRect(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                    EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
            }
        }
    }
    drawFixation(context, [Math.floor(EXPSETTINGS.matrixsize/2), Math.floor(EXPSETTINGS.matrixsize/2)], 1/5, 2 * EXPSETTINGS.padding);
}

function drawFixation(c, fixationPos, posScale, lineWidth) {
    let col = fixationPos[1];
    let row = fixationPos[0];
    c.lineWidth = lineWidth;
    c.strokeStyle = COLORPOOL.fixation;

    c.beginPath();
    // Horizontal line
    c.moveTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + posScale * EXPSETTINGS.cellSize,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + 1/2 * EXPSETTINGS.cellSize);
    c.lineTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + (1-posScale) * EXPSETTINGS.cellSize,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + 1/2 * EXPSETTINGS.cellSize);

    // Vertical line
    c.moveTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + 1/2 * EXPSETTINGS.cellSize + EXPSETTINGS.padding,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + posScale * EXPSETTINGS.cellSize + EXPSETTINGS.padding);
    c.lineTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + 1/2 * EXPSETTINGS.cellSize + EXPSETTINGS.padding,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + (1-posScale) * EXPSETTINGS.cellSize + EXPSETTINGS.padding);
    c.stroke();
}
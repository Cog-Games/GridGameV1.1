const DIRECTIONS = {
  arrowleft: {
    code: 37,
    movement: [0,-1],
  },
  arrowup: {
    code: 38,
    movement: [-1,0],
  },
  arrowright: {
    code: 39,
    movement: [0,1],
  },
  arrowdown: {
    code: 40,
    movement: [1,0],
  },
  // WASD controls
  keya: {
    code: 65,
    movement: [0,-1],
  },
  keyw: {
    code: 87,
    movement: [-1,0],
  },
  keyd: {
    code: 68,
    movement: [0,1],
  },
  keys: {
    code: 83,
    movement: [1,0],
  }
};


const ACTIONSPACE = [[0,1],[0,-1],[1,0],[-1,0]];

const NOISEACTIONSPACE = [[0,1],[0,-1],[1,0],[-1,0]];

const EXPSETTINGS = {
  padding: 2,
  cellSize: 40,
  matrixsize: 15
  };

const WINSETTING = {
  w: (EXPSETTINGS.cellSize + EXPSETTINGS.padding) * EXPSETTINGS.matrixsize + EXPSETTINGS.padding,
  h: (EXPSETTINGS.cellSize + EXPSETTINGS.padding) * EXPSETTINGS.matrixsize + EXPSETTINGS.padding

}

const COLORPOOL = {
  map: "white",
  line: "grey",
  obstacle: "black",
  player: "red",
  goal: "blue",
  fixation: "black"

}
const OBJECT = {
  blank: 0,
  obstacle: 1,
  player: 2,
  ai_player: 3,
  goal: 9
}
const STEPS_THRESHOLD = 8

const TILE_INDEXES = {
  sand: 18,
  grass: 23,
  ice: 86,
  decorations_ice: [105, 106, 122, 123], // Example decoration tile indexes (trees, buildings)
};
const TILE_SIZE = 64;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
class TinyTown extends Phaser.Scene {
  constructor() {
    super("TinyTown");
  }

  preload() {
    this.load.image("terrain-tiles", "path_to_tileset_image.png"); // Update path to your tileset
  }

  create() {
    this.map = this.make.tilemap({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = this.map.addTilesetImage("terrain-tiles", null, TILE_SIZE, TILE_SIZE);
    this.layer = this.map.createBlankLayer("Layer1", tileset);
    this.decorationLayer = this.map.createBlankLayer("DecorationLayer", tileset);

    this.generateMap();

    this.reload = this.input.keyboard.addKey("R");
  }
  update() {
    if (Phaser.Input.Keyboard.JustDown(this.reload)) {
      this.scene.restart();
    }
  }
  generateMap() {
    if (!this.layer || !this.decorationLayer) {
      console.error("Layer is not defined");
      return;
    }
    let rule_matrix = [
      ["G", "G", "G", "G", "G", "G"],
      ["G", "S", "S", "S", "S", "G"],
      ["G", "S", "I", "I", "S", "G"],
      ["G", "S", "I", "I", "S", "G"],
      ["G", "S", "S", "S", "S", "G"],
      ["S", "S", "S", "G", "G", "G"],
      ["I", "I", "S", "G", "G", "G"],
    ];
    const { tileFrequency, neighborRules } = this.parse_rules(rule_matrix);
    const matrix = this.possible_tiles();
    console.log(neighborRules);
    let WFC = true,
      contradiction = false;
    while (WFC || contradiction) {
      const cell = this.getLowestEntropy(matrix);
      if (!cell) break;
      this.collapse(cell, matrix);
      this.propagate(cell, matrix, neighborRules);
      contradiction = this.checkContradiction();
      WFC = this.checkIfCollapsed();
    }

    this.renderMatrix(matrix);
    this.addDecorations();
  }
  checkContradiction(matrix) {}
  checkIfCollapsed(matrix) {
    for (const row in matrix) {
      if (length(matrix[row]) != 1) {
        return False;
      }
    }
  }
  parse_rules(matrix) {
    const tileFrequency = {};
    const neighborRules = {};
    const rows = matrix.length;
    const cols = matrix[0].length;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const tile = matrix[i][j];

        // Update tile frequency
        if (tileFrequency[tile]) {
          tileFrequency[tile]++;
        } else {
          tileFrequency[tile] = 1;
        }

        // Check neighbors and build neighbor rules
        // Top neighbor
        if (i > 0) {
          const topNeighbor = matrix[i - 1][j];
          if (!neighborRules[tile]) {
            neighborRules[tile] = {};
          }
          if (!neighborRules[tile].top) {
            neighborRules[tile].top = [];
          }
          neighborRules[tile].top.push(topNeighbor);
        }

        // Right neighbor
        if (j < cols - 1) {
          const rightNeighbor = matrix[i][j + 1];
          if (!neighborRules[tile]) {
            neighborRules[tile] = {};
          }
          if (!neighborRules[tile].right) {
            neighborRules[tile].right = [];
          }
          neighborRules[tile].right.push(rightNeighbor);
        }

        // Bottom neighbor
        if (i < rows - 1) {
          const bottomNeighbor = matrix[i + 1][j];
          if (!neighborRules[tile]) {
            neighborRules[tile] = {};
          }
          if (!neighborRules[tile].bottom) {
            neighborRules[tile].bottom = [];
          }
          neighborRules[tile].bottom.push(bottomNeighbor);
        }

        // Left neighbor
        if (j > 0) {
          const leftNeighbor = matrix[i][j - 1];
          if (!neighborRules[tile]) {
            neighborRules[tile] = {};
          }
          if (!neighborRules[tile].left) {
            neighborRules[tile].left = [];
          }
          neighborRules[tile].left.push(leftNeighbor);
        }
      }
    }

    // Remove duplicates in the neighbor rules
    for (const tile in neighborRules) {
      for (const direction in neighborRules[tile]) {
        neighborRules[tile][direction] = [...new Set(neighborRules[tile][direction])];
      }
    }
    return { tileFrequency, neighborRules };
  }
  possible_tiles() {
    const matrix = Array.from({ length: MAP_HEIGHT }, () => Array.from({ length: MAP_WIDTH }, () => ["G", "I", "S"]));

    return matrix;
  }
  initializeMatrix() {
    return Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => ({
        options: [TILE_INDEXES.sand, TILE_INDEXES.grass, TILE_INDEXES.ice],
      }))
    );
  }

  getLowestEntropy(matrix) {
    let minEntropy = Infinity;
    const candidates = [];

    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        const cell = matrix[row][col];
        const entropy = cell.length;

        if (entropy === 1) continue;

        if (entropy < minEntropy) {
          minEntropy = entropy;
          candidates.length = 0;
          candidates.push({ row, col });
        } else if (entropy === minEntropy) {
          candidates.push({ row, col });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  collapse(cell, matrix) {
    const { row: x, col: y } = cell;
    let tiles = matrix[x][y];

    // If the cell is already collapsed, do nothing
    if (tiles.length === 1) {
      return;
    }

    // Collapse the cell by randomly selecting one tile
    let selectedTile = tiles[Math.floor(Math.random() * tiles.length)];
    matrix[x][y] = [selectedTile];
  }
  propagate(cell, matrix, neighborRules) {
    let queue = [[cell["row"], cell["col"]]];
    let visited = new Set();
    // Directions for neighbors: top, right, bottom, left
    const directions = [
      { dx: 0, dy: -1, direction: "top" }, // top
      { dx: 1, dy: 0, direction: "right" }, // right
      { dx: 0, dy: 1, direction: "bottom" }, // bottom
      { dx: -1, dy: 0, direction: "left" }, // left
    ];

    while (queue.length > 0) {
      let currentCell = queue.pop();
      let x = currentCell[0],
        y = currentCell[1];

      if (visited.has(`${x},${y}`)) continue;
      visited.add(`${x},${y}`);

      let curr = matrix[x][y];
      if (curr.length != 1) {
        continue;
      }
      for (let { dx, dy, direction } of directions) {
        let nx = x + dx,
          ny = y + dy;

        // Ensure the neighbor is within bounds
        if (nx >= 0 && ny >= 0 && nx < matrix.length && ny < matrix[0].length) {
          // If neighbor cell hasn't been set (its state is not final), and it doesn't match the expected state
          if (matrix[nx][ny].length != 1 && matrix[nx][ny] != neighborRules[curr][direction]) {
            // Update the neighbor's state
            matrix[nx][ny] = neighborRules[curr][direction];

            // Push the neighbor to the queue for further processing
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  renderMatrix(matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const tilename = matrix[y][x];
        let tileIndex;
        if (tilename == "S") {
          tileIndex = TILE_INDEXES.sand;
        } else if (tilename == "G") {
          tileIndex = TILE_INDEXES.grass;
        } else {
          tileIndex = TILE_INDEXES.ice;
        }

        this.layer.putTileAt(tileIndex, x, y);
      }
    }
  }

  addDecorations() {
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, MAP_WIDTH - 1);
      const y = Phaser.Math.Between(0, MAP_HEIGHT - 1);

      const tile = this.layer.getTileAt(x, y);
      if (tile && tile.index === TILE_INDEXES.ice) {
        const decorationTile = Phaser.Math.RND.pick(TILE_INDEXES.decorations_ice);
        this.decorationLayer.putTileAt(decorationTile, x, y);
      }
    }
  }
}

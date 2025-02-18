const TILE_INDEXES = {
  sand: 18,
  grass: 23,
  ice: 86,
  decorations_ice: [105, 106, 122, 123],      
  decorations_grass: [128,110],
  decorations_sand: [132, 128]           
};
const TILE_SIZE = 64;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;

class TinyTown extends Phaser.Scene {
  constructor() {
    super("TinyTown");
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

    this.useContextSensitive = false; // Default to base-level WFC
    
    noise.seed(Math.random()); // Seed the noise generator

    this.generateMap();

    this.reload = this.input.keyboard.addKey("R"); // Restart
    this.toggleAlgorithm = this.input.keyboard.addKey("C"); // Toggle context-sensitive mode
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.reload)) {
      this.scene.restart();
    }
    if (Phaser.Input.Keyboard.JustDown(this.toggleAlgorithm)) {
      this.useContextSensitive = !this.useContextSensitive;
      console.log(`Switched to ${this.useContextSensitive ? "Context-Sensitive" : "Base-Level"} WFC`);
      this.scene.restart();
    }
  }

  generateMap(){
    if(!this.layer || !this.decorationLayer){
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
  
    let contradiction = false;
    let fullyCollapsed = false;
  
    while(!fullyCollapsed && !contradiction){
      const cell = this.getLowestEntropy(matrix);
      if (!cell) break;
  
      this.collapse(cell, matrix, neighborRules);
      this.propagate(cell, matrix, neighborRules);
  
      contradiction = this.checkContradiction(matrix);
      fullyCollapsed = this.checkIfCollapsed(matrix);
    }
  
    if (contradiction){
      console.error("Contradiction found! Restarting...");
      this.scene.restart();
    } else {
      this.renderMatrix(matrix);
      this.addDecorations(); // Updated decoration routine
    }
  }

  checkContradiction(matrix) {
    for (let row of matrix) {
      for (let cell of row) {
        if (cell.length === 0) return true;
      }
    }
    return false;
  }

  checkIfCollapsed(matrix) {
    for (let row of matrix) {
      for (let cell of row) {
        if (cell.length !== 1) return false;
      }
    }
    return true;
  }

  parse_rules(matrix) {
    const tileFrequency = {};
    const neighborRules = {};
    const rows = matrix.length;
    const cols = matrix[0].length;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const tile = matrix[i][j];
        tileFrequency[tile] = (tileFrequency[tile] || 0) + 1;
  
        // Top neighbor
        if (i > 0) {
          const topNeighbor = matrix[i - 1][j];
          neighborRules[tile] = neighborRules[tile] || {};
          neighborRules[tile].top = neighborRules[tile].top || [];
          neighborRules[tile].top.push(topNeighbor);
        }
        // Right neighbor
        if (j < cols - 1) {
          const rightNeighbor = matrix[i][j + 1];
          neighborRules[tile] = neighborRules[tile] || {};
          neighborRules[tile].right = neighborRules[tile].right || [];
          neighborRules[tile].right.push(rightNeighbor);
        }
        // Bottom neighbor
        if (i < rows - 1) {
          const bottomNeighbor = matrix[i + 1][j];
          neighborRules[tile] = neighborRules[tile] || {};
          neighborRules[tile].bottom = neighborRules[tile].bottom || [];
          neighborRules[tile].bottom.push(bottomNeighbor);
        }
        // Left neighbor
        if (j > 0) {
          const leftNeighbor = matrix[i][j - 1];
          neighborRules[tile] = neighborRules[tile] || {};
          neighborRules[tile].left = neighborRules[tile].left || [];
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
    return Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => ["G", "I", "S"])
    );
  }

  getLowestEntropy(matrix) {
    let minEntropy = Infinity;
    const candidates = [];
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        const cell = matrix[row][col];
        if (cell.length === 1) continue;
        if (cell.length < minEntropy) {
          minEntropy = cell.length;
          candidates.length = 0;
          candidates.push({ row, col });
        } else if (cell.length === minEntropy) {
          candidates.push({ row, col });
        }
      }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  collapse(cell, matrix, neighborRules) {
    const { row, col } = cell;
    const options = matrix[row][col];
    if (options.length === 1) return;
  
    if (this.useContextSensitive) {
      let bestTile = null;
      let bestScore = -Infinity;
      for (let tile of options) {
        const score = this.calculateCompatibilityScore(row, col, tile, matrix, neighborRules);
        if (score > bestScore) {
          bestScore = score;
          bestTile = tile;
        }
      }
      matrix[row][col] = [bestTile];
    } else {
      // Use Perlin noise to bias selection.
      const scale = 10;
      const noiseValue = noise.perlin2(col / scale, row / scale);
      const normalized = (noiseValue + 1) / 2;
      
      // Divide the range into three equal segments:
      if (normalized < 0.33) {
        matrix[row][col] = ["G"];
      } else if (normalized < 0.66) {
        matrix[row][col] = ["I"];
      } else {
        matrix[row][col] = ["S"];
      }
    }
  }

  calculateCompatibilityScore(x, y, tile, matrix, neighborRules) {
    let score = 0;
    const directions = [
      { dx: 0, dy: -1, direction: "top" },
      { dx: 1, dy: 0, direction: "right" },
      { dx: 0, dy: 1, direction: "bottom" },
      { dx: -1, dy: 0, direction: "left" },
    ];
    for (let { dx, dy, direction } of directions) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < matrix.length && ny < matrix[0].length) {
        const neighbor = matrix[nx][ny];
        if (neighbor.length === 1 && neighborRules[tile][direction]?.includes(neighbor[0])) {
          score++;
        }
      }
    }
    return score;
  }
  
  propagate(cell, matrix, neighborRules) {
    const queue = [[cell.row, cell.col]];
    const visited = new Set();
    const directions = [
      { dx: 0, dy: -1, direction: "top" },
      { dx: 1, dy: 0, direction: "right" },
      { dx: 0, dy: 1, direction: "bottom" },
      { dx: -1, dy: 0, direction: "left" },
    ];
  
    while (queue.length) {
      const [x, y] = queue.pop();
      if (visited.has(`${x},${y}`)) continue;
      visited.add(`${x},${y}`);
  
      const current = matrix[x][y];
      if (current.length !== 1) continue;
  
      for (let { dx, dy, direction } of directions) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < matrix.length && ny < matrix[0].length) {
          const neighbor = matrix[nx][ny];
          if (neighbor.length !== 1) {
            const allowed = neighborRules[current[0]][direction];
            const newOptions = neighbor.filter(option => allowed.includes(option));
            if (newOptions.length !== neighbor.length) {
              matrix[nx][ny] = newOptions;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }

  renderMatrix(matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const tileType = matrix[y][x][0];
        let tileIndex;
        if (tileType === "S") {
          tileIndex = TILE_INDEXES.sand;
        } else if (tileType === "G") {
          tileIndex = TILE_INDEXES.grass;
        } else {
          tileIndex = TILE_INDEXES.ice;
        }
        this.layer.putTileAt(tileIndex, x, y);
      }
    }
  }

  // New decoration method using a noise-based clustering approach.
  addDecorations() {
    const decorationScale = 5; // Adjust this value to change clustering frequency.
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const baseTile = this.layer.getTileAt(x, y);
        if (baseTile) {
          // Use a secondary Perlin noise value to decide decoration placement.
          const decoNoise = noise.perlin2(x / decorationScale, y / decorationScale);
          // Normalize to [0, 1]
          const normalizedDeco = (decoNoise + 1) / 2;
  
          // For grass tiles, place a tree decoration if the noise value exceeds a threshold.
          if (baseTile.index === TILE_INDEXES.grass && normalizedDeco > 0.6) {
            const decorationTile = Phaser.Math.RND.pick(TILE_INDEXES.decorations_grass);
            this.decorationLayer.putTileAt(decorationTile, x, y);
          }
          // For ice tiles, place an ice decoration if the noise value exceeds a threshold.
          else if (baseTile.index === TILE_INDEXES.ice && normalizedDeco > 0.65) {
            const decorationTile = Phaser.Math.RND.pick(TILE_INDEXES.decorations_ice);
            this.decorationLayer.putTileAt(decorationTile, x, y);
          }
          // Optionally, you can also decorate sand tiles.
          else if (baseTile.index === TILE_INDEXES.sand && normalizedDeco > 0.7) {
            const decorationTile = Phaser.Math.RND.pick(TILE_INDEXES.decorations_sand);
            this.decorationLayer.putTileAt(decorationTile, x, y);
          }
        }
      }
    }
  }
}

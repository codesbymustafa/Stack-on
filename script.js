//constants
const BLOCK_HEIGHT = 30;
const INITIAL_BLOCK_WIDTH_LARGE = 220; 
const INITIAL_BLOCK_WIDTH_SMALL = 160; 
const SCREEN_SIZE_THRESHOLD = 600; 
const INITIAL_SPEED = 0.6;
const LEVEL_2_SPEED_MULTIPLIER = 1.15; 
const LEVEL_3_SPEED_MULTIPLIER = 1.3; 
const MAX_GAME_SPEED = 2; 
const LEVEL_2_THRESHOLD = 15;
const LEVEL_3_THRESHOLD = 30;
const VICTORY_THRESHOLD = 45;

let MAX_VISIBLE_BLOCKS = 8; 

// variables
let canvas, ctx;
let canvasWidth, canvasHeight;
let blocks = [];
let currentBlock = null;
let gameActive = false;
let score = 0;
let highScore = 0;
let gameSpeed = INITIAL_SPEED;
let direction = 1; // 1 -> right, -1 -> left
let level = 1;
let animationId = null;
let startFromLeft = true;

// Falling blocks array for animation
let fallingBlocks = [];

// DOM Elements
const instructionElement = document.getElementById('instruction');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const levelElement = document.getElementById('level');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const gameOverScreen = document.getElementById('gameOverScreen');
const victoryScreen = document.getElementById('victoryScreen');
const finalScoreElement = document.getElementById('finalScore');
const victoryScoreElement = document.getElementById('victoryScore');


function createBlock(x, y, width, height) {
    return {
        x,
        y,
        width,
        height,
        color: getRandomColor()
    };
}

function drawBlock(block) {
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    
    // Add a subtle 3D effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(block.x, block.y, block.width, 5);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(block.x, block.y + block.height - 5, block.width, 5);
    
    // Block outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.width, block.height);
}

function drawFallingBlocks() {
    fallingBlocks.forEach(block => {
        ctx.save();
        ctx.translate(block.x + block.width / 2, block.y + block.height / 2);
        ctx.rotate(block.rotation);
        ctx.fillStyle = block.color;
        ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
        ctx.restore();
    });
}

function drawTower() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw only the visible blocks (from the bottom of the array)
    const visibleBlocks = blocks.slice(-MAX_VISIBLE_BLOCKS);
    visibleBlocks.forEach(block => {
        drawBlock(block);
    });
    
    // Draw falling block pieces
    drawFallingBlocks();
    
    // Draw the current moving block
    if (currentBlock) {
        drawBlock(currentBlock);
    }
}

function resizeCanvas() {
    const container = canvas.parentElement;
    
    // Make canvas responsive to container width
    canvasWidth = container.clientWidth;
    canvas.width = canvasWidth;
    
    const desiredHeight = Math.min(
        canvasWidth * (4/3),             // Aspect ratio based height
        window.innerHeight * 0.7,        // 70% of viewport height
        800                              // Maximum absolute height
    );
    
    canvasHeight = Math.max(desiredHeight, 400); // Minimum height of 400px
    canvas.height = canvasHeight;

    MAX_VISIBLE_BLOCKS = Math.floor((canvasHeight/2) / BLOCK_HEIGHT) - 1; // Adjust max visible blocks based on height
    
    // Scale everything if needed
    if (gameActive) {
        // If game is already running, adjust block positions based on new dimensions
        const scaleY = canvasHeight / (blocks.length * BLOCK_HEIGHT * 1.5);
        if (scaleY < 1) {
            // Only scale down if needed (tower is too tall for new canvas)
            blocks.forEach(block => {
                block.y *= scaleY;
            });
            
            if (currentBlock) {
                currentBlock.y *= scaleY;
            }
        }
        
        drawTower();
    }
}

// Initialization
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    
    highScore = localStorage.getItem('stackOnHighScore') || 0;
    highScoreElement.textContent = highScore;
    
    resizeCanvas();
    
    startFromLeft = true;
    
    // Place initial base block (visible even before game starts)
    const initialBlockWidth = canvasWidth < SCREEN_SIZE_THRESHOLD ? 
        INITIAL_BLOCK_WIDTH_SMALL : INITIAL_BLOCK_WIDTH_LARGE;
    
    const initialBlock = createBlock(
        (canvasWidth - initialBlockWidth) / 2,
        canvasHeight - BLOCK_HEIGHT,
        initialBlockWidth,
        BLOCK_HEIGHT
    );
    blocks.push(initialBlock);
    
    // Draw the initial block
    drawTower();
    
    // Event listeners
    window.addEventListener('resize', resizeCanvas);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', startGame);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('click', handleCanvasClick);
}

// Generate a random color for blocks
function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 60%)`;
}

// Start the game
function startGame() {
    // Reset game state
    blocks = [];
    score = 0;
    level = 1;
    gameSpeed = INITIAL_SPEED;
    gameActive = true;
    
    // Reset edge alternation
    startFromLeft = true;
    
    // Hide menus, show instructions
    startBtn.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    instructionElement.style.opacity = 1;
    
    // Update UI
    scoreElement.textContent = score;
    levelElement.textContent = level;
    
    // Determine initial block width based on screen size
    const initialBlockWidth = canvasWidth < SCREEN_SIZE_THRESHOLD ? 
        INITIAL_BLOCK_WIDTH_SMALL : INITIAL_BLOCK_WIDTH_LARGE;
    
    // Initial block at bottom of canvas
    const initialBlock = createBlock(
        (canvasWidth - initialBlockWidth) / 2,
        canvasHeight - BLOCK_HEIGHT,
        initialBlockWidth,
        BLOCK_HEIGHT
    );
    blocks.push(initialBlock);
    
    // Create first moving block
    spawnNewBlock();
    
    // Start game loop
    gameLoop();
}

// Spawn a new block at the top
function spawnNewBlock() {
    const lastBlock = blocks[blocks.length - 1];
    let startX, initialDirection;
    
    // Alternate between left and right edge
    if (startFromLeft) {
        startX = 0; // Left edges
        initialDirection = 1; // Move right
    } else {
        startX = canvasWidth - lastBlock.width; // Right edge
        initialDirection = -1; // Move left
    }
    
    // Toggle for next block
    startFromLeft = !startFromLeft;
    
    const newBlock = createBlock(
        startX,
        lastBlock.y - BLOCK_HEIGHT,
        lastBlock.width,
        BLOCK_HEIGHT
    );
    currentBlock = newBlock;
    
    // Set the direction based on starting position
    direction = initialDirection;
}

// Update the current block position
function updateBlockPosition() {
    if (!currentBlock) return;
    
    // Move block horizontally with linear speed based on direction
    currentBlock.x += gameSpeed * direction * 3; // Multiply by 3 for proper visible speed
    
    // Bounce when hitting canvas edges
    if (currentBlock.x + currentBlock.width > canvasWidth) {
        currentBlock.x = canvasWidth - currentBlock.width;
        direction = -1; // Change direction to move left
    } else if (currentBlock.x < 0) {
        currentBlock.x = 0;
        direction = 1; // Change direction to move right
    }
}

// Drop the current block
function dropBlock() {
    if (!currentBlock || !gameActive) return;
    
    // Hide instruction after first interaction
    instructionElement.style.opacity = 0;
    
    const previousBlock = blocks[blocks.length - 1];
    
    // Calculate overhang
    const leftOverhang = Math.max(0, previousBlock.x - currentBlock.x);
    const rightOverhang = Math.max(0, currentBlock.x  - previousBlock.x);
    const overlapWidth = currentBlock.width - leftOverhang - rightOverhang;
    
    // Check if the block completely missed the tower
    if (overlapWidth <= 0) {
        gameOver();
        return;
    }
    
    // Store original block position and dimensions for animation
    const originalBlock = {
        x: currentBlock.x,
        y: currentBlock.y,
        width: currentBlock.width,
        height: currentBlock.height,
        color: currentBlock.color
    };
    
    // Adjust the dropped block to the overlap area
    currentBlock.width = overlapWidth;
    currentBlock.x = Math.max(currentBlock.x, previousBlock.x);
    
    // Add falling animation for cut-off parts
    if (leftOverhang > 0) {
        addFallingBlock(originalBlock.x, originalBlock.y, leftOverhang, BLOCK_HEIGHT, originalBlock.color , true);
    }
    if (rightOverhang > 0) {
        addFallingBlock(currentBlock.x + currentBlock.width, originalBlock.y, rightOverhang, BLOCK_HEIGHT, originalBlock.color , false);
    }
    
    // Add block to tower
    blocks.push(currentBlock);
    currentBlock = null;
    
    // Update score
    score++;
    scoreElement.textContent = score;
    
    // Check for level progression
    checkLevelProgression();
    
    // Check for victory
    if (score >= VICTORY_THRESHOLD) {
        victory();
        return;
    }
    
    // Shift the tower and spawn new block
    shiftTowerDown();
}

// Move all blocks down to keep tower in view
function shiftTowerDown() {
    // Remove the bottom block if we exceed the maximum visible blocks
    if (blocks.length > MAX_VISIBLE_BLOCKS) {
        blocks.shift(); // Remove the bottom block
    }
    
    // Shift all remaining blocks down by one block height
    const shiftAmount = BLOCK_HEIGHT;
    blocks.forEach(block => {
        block.y += shiftAmount;
    });
    
    // Ensure the bottom of the tower is always at a consistent height
    if (blocks.length > 0) {
        const bottomBlockY = blocks[0].y;
        const desiredBottomY = canvasHeight - BLOCK_HEIGHT;
        
        // If the bottom block is not at the desired position, adjust all blocks
        if (bottomBlockY !== desiredBottomY) {
            const adjustment = desiredBottomY - bottomBlockY;
            blocks.slice(-MAX_VISIBLE_BLOCKS).forEach(block => {
                block.y += adjustment;
            });
        }
    }
    
    // Spawn the next block after shifting
    spawnNewBlock();
}

// Add a falling block animation for cut-off parts
function addFallingBlock(x, y, width, height, color , isleft) {
    let rotat = Math.random() * 0.1; // Random rotation for falling blocks
    if(isleft) rotat = -rotat; // Reverse rotation for left side
    
    fallingBlocks.push({
        x,
        y,
        width,
        height,
        color,
        velocity: 0,
        rotation: rotat
    });
}

// Update falling blocks
function updateFallingBlocks() {
    const gravity = 0.5;
    
    for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const block = fallingBlocks[i];
        
        // Apply gravity
        block.velocity += gravity;
        block.y += block.velocity;
        block.rotation < 0 ? block.rotation -= 0.02 : block.rotation += 0.02;
        
        // Remove blocks that have fallen off screen
        if (block.y > canvasHeight) {
            fallingBlocks.splice(i, 1);
        }
    }
}

// Check if the player should progress to the next level
function checkLevelProgression() {
    if (score === LEVEL_2_THRESHOLD) {
        level = 2;
        levelElement.textContent = level;
        gameSpeed = Math.min(INITIAL_SPEED * LEVEL_2_SPEED_MULTIPLIER, MAX_GAME_SPEED);
    } else if (score === LEVEL_3_THRESHOLD) {
        level = 3;
        levelElement.textContent = level;
        gameSpeed = Math.min(INITIAL_SPEED * LEVEL_3_SPEED_MULTIPLIER, MAX_GAME_SPEED);
    }
}


// Main game loop
function gameLoop(timestamp) {
    if (!gameActive) return;
    
    // Update falling blocks regardless of game state
    updateFallingBlocks();
    
    // Update the current block position
    updateBlockPosition();
    
    drawTower();
    animationId = requestAnimationFrame(gameLoop);
}

// Handle game over
function gameOver() {
    gameActive = false;
    cancelAnimationFrame(animationId);
    
    // Update high score if needed
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('stackOnHighScore', highScore);
        highScoreElement.textContent = highScore;
    }
    
    // Show game over screen
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

// Handle victory
function victory() {
    gameActive = false;
    cancelAnimationFrame(animationId);
    
    // Update high score if needed
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('stackOnHighScore', highScore);
        highScoreElement.textContent = highScore;
    }
    
    // Show victory screen
    victoryScoreElement.textContent = score;
    victoryScreen.classList.remove('hidden');
}

// Event handlers
function handleKeyDown(e) {
    if (e.code === 'Space') {
        if(gameActive) 
            dropBlock();
        else
            startGame();
    }
}

function handleCanvasClick() {
    if (gameActive) {
        dropBlock();
    }
}

// Initialize the game when page loads
window.addEventListener('load',init );

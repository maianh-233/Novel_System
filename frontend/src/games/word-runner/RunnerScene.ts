import * as Phaser from 'phaser';

/** Kích thước gốc của khung game; Phaser tự co giãn cho vừa chỗ (Scale.FIT). */
export const WIDTH = 800;
export const HEIGHT = 320;

const GROUND_Y = 262;
const RUNNER_X = 150;
const SPAWN_X = WIDTH + 70;
/** Mép trái chướng ngại vật chạm bạn nhỏ ở đây. */
const HIT_X = RUNNER_X + 40;
const JUMP_MS = 640;
const JUMP_HEIGHT = 125;
/** Tốc độ chạy khi chưa có chướng ngại vật (px/ms). */
const IDLE_SPEED = 0.12;
/** Gõ xong thì chướng ngại vật lao tới nhanh hơn để em khỏi phải chờ. */
const CLEARED_BOOST = 2.4;
const STUMBLE_MS = 750;

const INK = 0x1e2a5a;
const SUN = 0xffc531;
const TOMATO = 0xff5a4e;
const MINT = 0x2fcb8b;
const SKY = 0x2d9cff;
const VIOLET = 0x8b6cff;
const FONT = '"Baloo 2 Variable", "Baloo 2", system-ui, sans-serif';

const OBSTACLES = ['crate', 'rock', 'cone'] as const;

export interface RunnerCallbacks {
  /** Cảnh đã dựng xong, có thể thả chướng ngại vật đầu tiên. */
  onReady(): void;
  /** Chướng ngại vật chạm bạn nhỏ khi em chưa gõ xong. */
  onHit(): void;
  /** Chướng ngại vật đã qua (nhảy qua hoặc vấp xong) — sẵn sàng cho từ tiếp theo. */
  onPassed(): void;
}

interface Obstacle {
  box: Phaser.GameObjects.Container;
  sign: Phaser.GameObjects.Container;
  typed: Phaser.GameObjects.Text;
  rest: Phaser.GameObjects.Text;
  display: string;
  speed: number;
  cleared: boolean;
  jumped: boolean;
  hit: boolean;
}

/**
 * Cảnh chạy của Word Runner: bạn nhỏ chạy tại chỗ, mặt đất trôi, chướng ngại vật mang
 * một từ chạy tới. React lo phần gõ phím và chấm điểm, chỉ ra lệnh cho cảnh qua
 * `spawn` / `setTyped` / `clearObstacle` / `wrongKey`; cảnh báo lại qua `RunnerCallbacks`.
 */
export class RunnerScene extends Phaser.Scene {
  private cb: RunnerCallbacks;
  private clouds!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private runner!: Phaser.GameObjects.Image;
  private obstacle: Obstacle | null = null;
  private frameMs = 0;
  private frame = 0;
  private airborne = false;
  private stumbleUntil = 0;

  constructor(cb: RunnerCallbacks) {
    super('runner');
    this.cb = cb;
  }

  create() {
    makeTextures(this);
    this.cameras.main.setBackgroundColor('#eef7ff');
    this.clouds = this.add.tileSprite(0, 18, WIDTH, 90, 'clouds').setOrigin(0);
    this.hills = this.add
      .tileSprite(0, GROUND_Y - 80, WIDTH, 80, 'hills')
      .setOrigin(0);
    this.ground = this.add
      .tileSprite(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y, 'ground')
      .setOrigin(0);
    this.runner = this.add
      .image(RUNNER_X, GROUND_Y + 2, 'kid-0')
      .setOrigin(0.5, 1)
      .setDepth(2);
    this.cb.onReady();
  }

  /** Thả chướng ngại vật mang từ `display`; nó tới chỗ bạn nhỏ sau `travelMs`. */
  spawn(display: string, typedCount: number, travelMs: number, seq: number) {
    this.obstacle?.box.destroy();
    const kind = OBSTACLES[seq % OBSTACLES.length];
    const body = this.add.image(0, 0, kind).setOrigin(0.5, 1);

    const typed = this.add.text(0, 0, '', textStyle('#13734c'));
    const rest = this.add.text(0, 0, '', textStyle('#1e2a5a'));
    const sign = this.add.container(0, -body.height - 18);
    sign.add([this.add.graphics(), typed, rest]);

    const box = this.add.container(SPAWN_X, GROUND_Y + 2, [body, sign]);
    box.setDepth(1);
    this.obstacle = {
      box,
      sign,
      typed,
      rest,
      display,
      speed: (SPAWN_X - HIT_X) / travelMs,
      cleared: false,
      jumped: false,
      hit: false,
    };
    this.layoutSign(typedCount);
  }

  /** Tô xanh phần em đã gõ trên biển chữ. */
  setTyped(typedCount: number) {
    this.layoutSign(typedCount);
  }

  /** Em gõ xong từ: bạn nhỏ sẽ tự nhảy qua khi chướng ngại vật tới gần. */
  clearObstacle() {
    if (!this.obstacle || this.obstacle.hit) return;
    this.obstacle.cleared = true;
    this.layoutSign(this.obstacle.display.length);
    // Biển chữ tô xanh rồi bay lên, để bạn nhỏ chỉ phải nhảy qua chướng ngại vật.
    const sign = this.obstacle.sign;
    this.tweens.killTweensOf(sign);
    sign.x = 0;
    this.tweens.add({
      targets: sign,
      y: sign.y - 40,
      alpha: 0,
      delay: 150,
      duration: 380,
      ease: 'Quad.easeIn',
    });
  }

  /** Gõ sai: biển chữ rung nhẹ. */
  wrongKey() {
    const sign = this.obstacle?.sign;
    if (!sign) return;
    this.tweens.killTweensOf(sign);
    sign.x = 0;
    this.tweens.add({
      targets: sign,
      x: { from: -6, to: 6 },
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => (sign.x = 0),
    });
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50); // tab bị treo lâu thì không nhảy cóc
    const o = this.obstacle;
    const stumbling = time < this.stumbleUntil;
    const speed = stumbling
      ? 0
      : o
        ? o.speed * (o.cleared ? CLEARED_BOOST : 1)
        : IDLE_SPEED;

    this.ground.tilePositionX += speed * dt;
    this.hills.tilePositionX += speed * dt * 0.3;
    this.clouds.tilePositionX += (speed * 0.08 + 0.01) * dt;

    if (!this.airborne && !stumbling) {
      this.frameMs += dt;
      if (this.frameMs > 120) {
        this.frameMs = 0;
        this.frame = 1 - this.frame;
        this.runner.setTexture(`kid-${this.frame}`);
      }
    }

    if (!o) return;
    if (!o.hit) o.box.x -= speed * dt;

    // Nhảy sao cho chướng ngại vật đi qua đúng lúc bạn nhỏ lên cao nhất.
    if (o.cleared && !o.jumped && o.box.x - RUNNER_X <= (speed * JUMP_MS) / 2) {
      o.jumped = true;
      this.jump();
    }
    if (o.cleared && o.box.x < RUNNER_X - 90) {
      o.box.destroy();
      this.obstacle = null;
      this.cb.onPassed();
      return;
    }
    if (!o.cleared && !o.hit && o.box.x <= HIT_X) {
      o.hit = true;
      this.stumble(time, o);
      this.cb.onHit();
    }
  }

  private jump() {
    this.airborne = true;
    this.runner.setTexture('kid-jump');
    this.tweens.add({
      targets: this.runner,
      y: GROUND_Y + 2 - JUMP_HEIGHT,
      duration: JUMP_MS / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        this.airborne = false;
        this.runner.setTexture('kid-0');
      },
    });
  }

  private stumble(time: number, o: Obstacle) {
    this.stumbleUntil = time + STUMBLE_MS;
    this.runner.setTexture('kid-oops');
    this.tweens.add({
      targets: this.runner,
      angle: { from: -14, to: 0 },
      duration: STUMBLE_MS,
      ease: 'Back.easeOut',
    });
    // Chướng ngại vật bật ra phía trước rồi mờ đi.
    this.tweens.add({
      targets: o.box,
      x: o.box.x + 70,
      angle: 25,
      alpha: 0,
      duration: STUMBLE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        o.box.destroy();
        if (this.obstacle === o) this.obstacle = null;
        this.runner.setTexture('kid-0');
        this.cb.onPassed();
      },
    });
  }

  private layoutSign(typedCount: number) {
    const o = this.obstacle;
    if (!o) return;
    o.typed.setText(o.display.slice(0, typedCount));
    o.rest.setText(o.display.slice(typedCount));
    const textW = o.typed.width + o.rest.width;
    const w = Math.max(64, textW + 28);
    const h = 46;
    o.typed.setPosition(-textW / 2, -h / 2 - 1).setOrigin(0, 0.5);
    o.rest
      .setPosition(-textW / 2 + o.typed.width, -h / 2 - 1)
      .setOrigin(0, 0.5);
    const g = o.sign.getAt(0) as Phaser.GameObjects.Graphics;
    g.clear();
    g.lineStyle(3, INK);
    g.lineBetween(0, 0, 0, 20);
    g.fillStyle(INK);
    g.fillRoundedRect(-w / 2 + 3, -h + 3, w, h, 12);
    g.fillStyle(o.cleared ? MINT : 0xffffff);
    g.fillRoundedRect(-w / 2, -h, w, h, 12);
    g.strokeRoundedRect(-w / 2, -h, w, h, 12);
  }
}

const textStyle = (color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: '30px',
  fontStyle: 'bold',
  color,
});

/** Vẽ mọi hình bằng code — không cần file ảnh, không phụ thuộc bản quyền. */
function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('kid-0')) return;
  const g = scene.add.graphics();

  // Bạn nhỏ: 2 khung chạy, 1 khung nhảy, 1 khung vấp.
  const kid = (key: string, legs: () => void, mouth: 'smile' | 'o') => {
    g.clear();
    g.lineStyle(7, INK);
    legs();
    // Thân
    g.fillStyle(SKY);
    g.fillRoundedRect(16, 40, 34, 34, 10);
    g.lineStyle(3, INK);
    g.strokeRoundedRect(16, 40, 34, 34, 10);
    // Đầu + mũ
    g.fillStyle(0xffd9b3);
    g.fillCircle(33, 26, 20);
    g.strokeCircle(33, 26, 20);
    g.fillStyle(TOMATO);
    g.slice(33, 24, 20, Math.PI, 0, false);
    g.fillPath();
    g.strokePath();
    g.fillRect(33, 20, 26, 6);
    g.strokeRect(33, 20, 26, 6);
    // Mắt + miệng
    g.fillStyle(INK);
    g.fillCircle(41, 30, 3);
    if (mouth === 'smile') {
      g.beginPath();
      g.arc(40, 36, 6, 0.2, Math.PI - 0.6);
      g.strokePath();
    } else {
      g.strokeCircle(42, 39, 3.5);
    }
    g.generateTexture(key, 66, 100);
  };
  kid(
    'kid-0',
    () => {
      g.lineBetween(26, 72, 16, 96);
      g.lineBetween(40, 72, 50, 96);
    },
    'smile',
  );
  kid(
    'kid-1',
    () => {
      g.lineBetween(28, 72, 34, 97);
      g.lineBetween(38, 72, 30, 97);
    },
    'smile',
  );
  kid(
    'kid-jump',
    () => {
      g.lineBetween(26, 72, 14, 86);
      g.lineBetween(40, 72, 54, 84);
    },
    'smile',
  );
  kid(
    'kid-oops',
    () => {
      g.lineBetween(28, 72, 20, 97);
      g.lineBetween(38, 72, 46, 97);
    },
    'o',
  );

  // Chướng ngại vật
  g.clear();
  g.fillStyle(SUN);
  g.fillRoundedRect(3, 3, 52, 52, 6);
  g.lineStyle(4, INK);
  g.strokeRoundedRect(3, 3, 52, 52, 6);
  g.lineStyle(3, INK);
  g.lineBetween(8, 8, 50, 50);
  g.lineBetween(50, 8, 8, 50);
  g.generateTexture('crate', 58, 58);

  g.clear();
  g.fillStyle(0xa9b4cc);
  g.fillEllipse(36, 30, 66, 50);
  g.lineStyle(4, INK);
  g.strokeEllipse(36, 30, 66, 50);
  g.fillStyle(0xc9d2e3);
  g.fillEllipse(26, 20, 18, 10);
  g.generateTexture('rock', 72, 48);

  g.clear();
  g.fillStyle(TOMATO);
  g.fillTriangle(26, 4, 6, 56, 46, 56);
  g.fillStyle(0xffffff);
  g.fillRect(14, 32, 24, 8);
  g.lineStyle(4, INK);
  g.strokeTriangle(26, 4, 6, 56, 46, 56);
  g.fillStyle(VIOLET);
  g.fillRoundedRect(2, 54, 48, 8, 3);
  g.strokeRoundedRect(2, 54, 48, 8, 3);
  g.generateTexture('cone', 52, 64);

  // Mây
  g.clear();
  g.fillStyle(0xffffff);
  g.lineStyle(3, 0xc6dcf5);
  for (const [x, y, w, h] of [
    [70, 40, 110, 40],
    [100, 28, 70, 40],
    [300, 60, 90, 30],
  ]) {
    g.fillEllipse(x, y, w, h);
    g.strokeEllipse(x, y, w, h);
  }
  g.generateTexture('clouds', 420, 90);

  // Đồi
  g.clear();
  g.fillStyle(0xbfeedd);
  g.fillCircle(90, 120, 95);
  g.fillCircle(330, 140, 120);
  g.fillCircle(520, 110, 70);
  g.generateTexture('hills', 600, 80);

  // Mặt đất: dải cỏ + vạch đất để thấy đang chạy.
  g.clear();
  g.fillStyle(0xf3e3c3);
  g.fillRect(0, 0, 80, HEIGHT - GROUND_Y);
  g.fillStyle(MINT);
  g.fillRect(0, 0, 80, 12);
  g.lineStyle(3, INK);
  g.lineBetween(0, 1, 80, 1);
  g.lineStyle(3, 0xd9c49b);
  g.lineBetween(10, 30, 34, 30);
  g.lineBetween(50, 44, 70, 44);
  g.generateTexture('ground', 80, HEIGHT - GROUND_Y);

  g.destroy();
}

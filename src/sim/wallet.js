export class Wallet {
  constructor(money) {
    this.money = money;
    this.totalEarned = 0;
  }

  canAfford(n) {
    return this.money >= 0 && this.money >= n;
  }

  spend(n) {
    if (!this.canAfford(n)) return false;
    this.money -= n;
    return true;
  }

  earn(n) {
    this.money += n;
    this.totalEarned += n;
  }

  // Always applied, may make money negative (salaries).
  charge(n) {
    this.money -= n;
  }
}

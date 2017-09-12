class Cacl {
  constructor(num) {
    this._num = num;
  }

  set num(n) {
    if (typeof n !== 'number') {
      throw "num is not a function";
    }
    this._num = n;
  }

  get num() {
    return this._num;
  }

  add(a) {
    this._num += a;
  }

  minus(a) {
    this._num -= a;
  }

  times(a) {
    this._num *= a;
  }

  divides(a) {
    this._num /= a;
  }
}

export default Cacl;
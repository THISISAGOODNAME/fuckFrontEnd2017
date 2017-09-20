"use strict";
window.onload = function () {

  // 初始化 WebGL上 下文
  var gl = (function () {

    var canvas = document.getElementById('canvas');
    var gl = canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      console.log('WebGL在当前浏览器上不受支持!');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Установить координаты окна в canvas для WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);

    // При изменении размеров окна, установить новые координаты
    window.addEventListener('resize', function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    });

    return gl;

  }());

  // 编译着色器
  var program = (function (gl, attribs, uniforms) {

    var compileShader = function (source, type) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', source, false);
      xhr.send();

      var shader = gl.createShader(type);
      gl.shaderSource(shader, xhr.responseText);
      gl.compileShader(shader);

      return shader;
    }

    var program = gl.createProgram();
    gl.attachShader(program, compileShader('vertex.glsl', gl.VERTEX_SHADER));
    gl.attachShader(program, compileShader('fragment.glsl', gl.FRAGMENT_SHADER));

    gl.linkProgram(program);
    gl.useProgram(program);

    for (var i in attribs)
      program[attribs[i]] = gl.getAttribLocation(program, attribs[i]);

    for (var i in uniforms)
      program[uniforms[i]] = gl.getUniformLocation(program, uniforms[i]);

    return program;

  }(gl, ['aVertex', 'aNormal', 'aTexture', 'aSWeights', 'aSIndices', 'aSample'],
    ['uP', 'uV', 'uM', 'uN', 'uBones', 'uSample', 'uLightPos']));



  // Очистить экран и залить его черным
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Учитывать расположение объектов по оси Z при рендеринге
  gl.enable(gl.DEPTH_TEST);

  // Создать экземпляр фигуры из описания модели
  var mesh = new Mesh((function () {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'model.json', false);
    xhr.send();

    var data = JSON.parse(xhr.responseText);

    // Приведение данных в соответствии с нашей моделью (убираем лишнее)
    var model = {
      geometry: {
        uvs: data.uvs[0],
        faces: data.faces,
        skinIndices: data.skinIndices,
        skinWeights: data.skinWeights,
        vertices: data.vertices,
        normals: data.normals,
        bones: []
      },
      materials: [],
      keyframes: []
    };

    for (var i = 0; i < data.materials.length; i++)
      model.materials[i] = {texture: 'samples/' + data.materials[i].mapDiffuse};

    for (var i = 0; i < data.bones.length; i++) {
      model.geometry.bones[i] = {
        parent: data.bones[i].parent,
        pos: data.bones[i].pos,
        rot: data.bones[i].rotq
      };
    }

    // От костей из кадров, до кадров из костей...
    for (var i = 0, bones = data.animations[0].hierarchy; i < bones.length; i++) {
      for (var j = 0; j < bones[i].keys.length; j++) {
        if (!model.keyframes[j]) model.keyframes[j] = [];
        model.keyframes[j][i] = {pos: bones[i].keys[j].pos, rot: bones[i].keys[j].rot};
      }
    }

    // Начальные параметры фигуры (для матрицы модели)
    model.geometry.position = [0, -5, 0];
    model.geometry.rotate = [0, 0, 0];
    model.geometry.scale = [1, 1, 1];

    return model;

  }()), gl);

  var moving = false;

  // Интерфейс
  (function () {
    var capture = false, lastX, lastY;

    // Упраление матрицей вида с помощью мышки
    document.addEventListener('mousedown', function (event) {
      if (event.which === 1)
        capture = true;
      lastX = event.pageX;
      lastY = event.pageY;
    });

    document.addEventListener('mousemove', function (event) {
      if (capture) {
        var deltaX = event.pageX - lastX;
        var deltaY = event.pageY - lastY;

        lastX = event.pageX;
        lastY = event.pageY;
        orbitX += deltaY * 0.005;
        orbitY += deltaX * 0.005;
      }
    });

    document.addEventListener('mouseup', function () {
      capture = false;
    });

    document.addEventListener('wheel', function (event) {
      distance += event.deltaY * 0.005;
    });

    // Управляем движением модели
    document.addEventListener('keydown', function (event) {
      switch (event.code) {
        case 'Space':
          moving = !moving;
          break;
        default:
          break;
      }
    });
  }());

  var uP = mat4.create(), distance = 30, orbitX = 0, orbitY = 0;

  // Создаем матрицу перспективной проекции
  mat4.perspective(uP, 45 / 180 * Math.PI,
    window.innerWidth / window.innerHeight, 0.01, 500.0);

  (function animate(time) {

    // Считаем разницу между временем последней отрисовки и настоящим моментом
    var delta = time - (animate.timeOld || time);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Экспортируем перспективную матрицу
    gl.uniformMatrix4fv(program.uP, false, uP);

    // Создаем и экспортируем матрицу вида
    var uV = mat4.create();
    mat4.identity(uV);
    mat4.rotate(uV, uV, orbitX, [1.0, 0.0, 0.0]);
    mat4.rotate(uV, uV, orbitY, [0.0, 1.0, 0.0]);
    mat4.translate(uV, uV, [0, 0, -distance]);
    gl.uniformMatrix4fv(program.uV, false, uV);

    // Настраиваем источник освещение (в координатах модели)
    gl.uniform3f(program.uLightPos, 0, -10, distance);

    mesh.draw(gl, program);

    if (moving)
      mesh.curLerp += 0.005 * delta;

    // Запомнить время в настоящий момент
    animate.timeOld = time;

    // Вызвать функцию еще раз, когда есть ресурсы (видеокарты свободна)
    // Этот метод гораздо лучше setInterval
    requestAnimationFrame(animate);

  }(0));

}

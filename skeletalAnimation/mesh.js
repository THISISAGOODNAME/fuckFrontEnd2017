// 模型加载类
var Mesh = function (model, gl) {

  this.geometry = model.geometry;
  this.keyframes = model.keyframes;
  this.materials = [];
  this._textures = {};

  function loadTexture(src) {
    if (this._textures[src])
      return this._textures[src];

    var image = new Image();
    var texture = {
      id: Object.keys(this._textures).length,
      sample: gl.createTexture(),
      ready: false
    };
    image.src = src;
    image.onload = function () {
      //将纹理加载到显卡的缓冲区中
      gl.bindTexture(gl.TEXTURE_2D, texture.sample);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      texture.ready = true;
    };

    return (this._textures[src] = texture);
  }

  for (var i = 0; i < model.materials.length; i++)
    this.materials[i] = loadTexture.call(this, model.materials[i].texture);

  var indices = [], vertices = [], normals = [], uvs = [], textures = [];
  var skinIndices = [], skinWeights = [], face;

  // 解析 Three JS JSON 模型格式
  for (var i = 0; i * 11 < this.geometry.faces.length; i++) {
    var faces = this.geometry.faces;
    for (var j = 0; j < 3; j++) {
      indices.push(i * 3 + j);
      textures.push(this.materials[faces[i * 11 + 4]].id);
      vertices.push(this.geometry.vertices[faces[i * 11 + 1 + j] * 3]);
      vertices.push(this.geometry.vertices[faces[i * 11 + 1 + j] * 3 + 1]);
      vertices.push(this.geometry.vertices[faces[i * 11 + 1 + j] * 3 + 2]);
      uvs.push(this.geometry.uvs[faces[i * 11 + 5 + j] * 2]);
      uvs.push(this.geometry.uvs[faces[i * 11 + 5 + j] * 2 + 1]);
      normals.push(this.geometry.normals[faces[i * 11 + 8 + j] * 3]);
      normals.push(this.geometry.normals[faces[i * 11 + 8 + j] * 3 + 1]);
      normals.push(this.geometry.normals[faces[i * 11 + 8 + j] * 3 + 2]);
      skinIndices.push(this.geometry.skinIndices[faces[i * 11 + 1 + j] * 2]);
      skinIndices.push(this.geometry.skinIndices[faces[i * 11 + 1 + j] * 2 + 1]);
      skinIndices.push(this.geometry.skinIndices[faces[i * 11 + 1 + j] * 2 + 2]);
      skinIndices.push(this.geometry.skinIndices[faces[i * 11 + 1 + j] * 2 + 3]);
      skinWeights.push(this.geometry.skinWeights[faces[i * 11 + 1 + j] * 2]);
      skinWeights.push(this.geometry.skinWeights[faces[i * 11 + 1 + j] * 2 + 1]);
      skinWeights.push(this.geometry.skinWeights[faces[i * 11 + 1 + j] * 2 + 2]);
      skinWeights.push(this.geometry.skinWeights[faces[i * 11 + 1 + j] * 2 + 3]);
    }
  }

  this._vertexBuffer = gl.createBuffer();
  this._indexBuffer = gl.createBuffer();
  this._normalBuffer = gl.createBuffer();
  this._uvsBuffer = gl.createBuffer();
  this._skinIndicesBuffer = gl.createBuffer();
  this._skinWeightsBuffer = gl.createBuffer();
  this._texturesBuffer = gl.createBuffer();

  for (var i = 0; i < this.geometry.bones.length; i++) {
    var bone = this.geometry.bones[i];
    bone.inverseBindpose = mat4.create();
    this._adjustBone(bone, bone.rot, bone.pos);
    mat4.invert(bone.inverseBindpose, bone.worldMatrix);
  }

  // 存储模型的状态（帧和插值参数）
  this.curFrame = this.curLerp = 0;

  // 初始化显卡缓冲区
  gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._uvsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._skinWeightsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skinWeights), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._skinIndicesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skinIndices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this._texturesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

// 骨骼动画算法
Mesh.prototype._adjustBone = function (bone, rot, pos) {
  bone.worldMatrix = mat4.create();
  bone.localMatrix = mat4.create();

  // 只考虑一个骨骼的localMatrix
  mat4.fromRotationTranslation(bone.localMatrix, rot, pos);

  if (bone.parent === -1) {
    // 如果骨骼是root，那么它的localMatrix经在世界坐标系
    mat4.copy(bone.worldMatrix, bone.localMatrix)
  } else {
    // 如果不是root(是子骨骼)，则将其乘以父骨骼的变换矩阵
    mat4.multiply(bone.worldMatrix,
      this.geometry.bones[bone.parent].worldMatrix, bone.localMatrix)
  }
};

Mesh.prototype.getKeyframe = function () {
  // 每次插补参数达到1时，都要添加帧
  while (this.curLerp > 1) {
    this.curLerp -= 1.0;
    this.curFrame++;
  }

  var flat = [];

  // 从动画中取出上一帧和下一帧
  var prevFrame = this.keyframes[this.curFrame % this.keyframes.length];
  var nextFrame = this.keyframes[(this.curFrame + 1) % this.keyframes.length];

  for (var i = 0; i < this.geometry.bones.length; i++) {
    var bone = this.geometry.bones[i];
    var prevBone = prevFrame[i], nextBone = nextFrame[i];
    var offsetMatrix = mat4.create(), lquat = quat.create(), lvec = vec3.create();

    // 考虑两个框架之间的骨骼的旋转和位置的中间值
    // 旋转 - 球面插值，用于线性位置
    quat.slerp(lquat, prevBone.rot, nextBone.rot, this.curLerp);
    vec3.lerp(lvec, prevBone.pos, nextBone.pos, this.curLerp);

    this._adjustBone(bone, lquat, lvec);
    mat4.multiply(offsetMatrix, bone.worldMatrix, bone.inverseBindpose);

    flat.push.apply(flat, offsetMatrix);
  }

  return new Float32Array(flat);
};

Mesh.prototype.draw = function (gl, program) {
  var mvMatrix = mat4.create();
  var nMatrix = mat3.create();

  // 创建一个模型矩阵
  mat4.identity(mvMatrix);
  mat4.translate(mvMatrix, mvMatrix, this.geometry.position);
  mat4.rotate(mvMatrix, mvMatrix, this.geometry.rotate[0], [1.0, 0.0, 0.0]);
  mat4.rotate(mvMatrix, mvMatrix, this.geometry.rotate[1], [0.0, 1.0, 0.0]);
  mat4.rotate(mvMatrix, mvMatrix, this.geometry.rotate[2], [0.0, 0.0, 1.0]);
  mat4.scale(mvMatrix, mvMatrix, this.geometry.scale);

  mat3.normalFromMat4(nMatrix, mvMatrix);

  gl.uniformMatrix4fv(program.uBones, false, this.getKeyframe());

  gl.uniformMatrix4fv(program.uM, false, mvMatrix);
  gl.uniformMatrix3fv(program.uN, false, nMatrix);

  var uSample = [];
  for (var key in this._textures) {
    if (this._textures[key].ready) {
      gl.activeTexture(gl['TEXTURE' + this._textures[key].id]);
      gl.bindTexture(gl.TEXTURE_2D, this._textures[key].sample);
    }
    uSample.push(this._textures[key].id);
  }
  gl.uniform1iv(program.uSample, uSample);

  gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
  gl.vertexAttribPointer(program.aVertex, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aVertex);

  gl.bindBuffer(gl.ARRAY_BUFFER, this._normalBuffer);
  gl.vertexAttribPointer(program.aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, this._uvsBuffer);
  gl.vertexAttribPointer(program.aTexture, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aTexture);

  // 对于每个顶点，有四个骨骼依赖于它
  // 在绝大多数情况下 - 一般取4或8
  gl.bindBuffer(gl.ARRAY_BUFFER, this._skinWeightsBuffer);
  // gl.vertexAttribPointer(program.aSWeights, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribPointer(program.aSWeights, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aSWeights);

  gl.bindBuffer(gl.ARRAY_BUFFER, this._skinIndicesBuffer);
  // gl.vertexAttribPointer(program.aSIndices, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribPointer(program.aSIndices, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aSIndices);

  gl.bindBuffer(gl.ARRAY_BUFFER, this._texturesBuffer);
  gl.vertexAttribPointer(program.aSample, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.aSample);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
  gl.drawElements(gl.TRIANGLES,
    Math.floor(this.geometry.faces.length / 11) * 3, gl.UNSIGNED_SHORT, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};
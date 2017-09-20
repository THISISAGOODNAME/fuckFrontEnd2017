uniform mat4 uP, uM, uV;
uniform mat4 uBones[32];

attribute float aSample;
attribute vec2 aTexture;
attribute vec3 aVertex, aNormal;
//attribute highp vec2 aSWeights;
//attribute highp vec2 aSIndices;
attribute highp vec4 aSWeights;
attribute highp vec4 aSIndices;

varying float vSample;
varying vec2 vTexture;
varying vec3 vVertex, vNormal;

mat4 boneTransform() {
  mat4 ret;

  // 权重之和必须为1，需要先标准化
//  float normfac = 1.0 / (aSWeights.x + aSWeights.y);
//  ret = normfac * aSWeights.y * uBones[int(aSIndices.y)]
//      + normfac * aSWeights.x * uBones[int(aSIndices.x)];

  float normfac = 1.0 / (aSWeights.x + aSWeights.y + aSWeights.z + aSWeights.w);
  ret = normfac * aSWeights.x * uBones[int(aSIndices.x)]
      + normfac * aSWeights.y * uBones[int(aSIndices.y)]
      + normfac * aSWeights.z * uBones[int(aSIndices.z)]
      + normfac * aSWeights.w * uBones[int(aSIndices.w)];

  return ret;
}

void main() {

  mat4 bt = boneTransform();

  // uP - матрица перспективного отображения
  // uM - матрица вида (из координат мира в координаты камеры)
  // uM - матрица модели (из координат модели в мировые)
  // bt - афинное преобразование, основанное на положениях костей

  gl_Position = uP * uV * uM * bt * vec4(aVertex, 1.0);
  vVertex = (bt * vec4(aVertex, 1.0)).xyz;
  vNormal = (bt * vec4(aNormal, 0.0)).xyz;
  vTexture = aTexture;
  vSample = aSample;

}

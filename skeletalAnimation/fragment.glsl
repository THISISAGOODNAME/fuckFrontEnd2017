precision highp float;

uniform mat3 uN;
uniform mat4 uM, uV;
uniform sampler2D uSample[4];
uniform vec3 uLightPos;

varying float vSample;
varying vec2 vTexture;
varying vec3 vVertex, vNormal;

// Возможно, это костыль, но один фрагментный шейдер - это наглядно
// Дело в том, что в ES 2.0 нельзя индексировать sampler массивы переменными
vec4 getColor() {
    int index = int(vSample);
    vec2 uv = vec2(vTexture.s, vTexture.t); 
    vec4 color;

    if (index == 0) {
        color = texture2D(uSample[0], uv);
    } else if (index == 1) {
        color = texture2D(uSample[1], uv);
    } else if (index == 2) {
        color = texture2D(uSample[2], uv);
    } else if (index == 3) {
        color = texture2D(uSample[3], uv);
    } else {
        color = vec4(0, 0, 0, 0);
    }

    // Можно добавить еще текстур, если 4 не хватает

    return color;
}

void main() {

  vec3 lAmbient = vec3(0.3, 0.3, 1.0);
  vec3 lDiffuse = vec3(0.3, 0.3, 1.0);
  vec3 lSpecular= vec3(1.0, 1.0, 1.0);

  // Направление света вычисляется в координатах камеры
  vec3 plDir = normalize(vec3(uV * uM * vec4(uLightPos, 1.0)) 
      - vec3(uV * uM * vec4(vVertex, 1.0)));

  vec3 n = normalize(uN * vNormal);
  vec3 l = normalize(plDir);
  vec3 v = normalize(-vVertex);
  vec3 r = reflect(l, n);

  vec4 tColor = getColor();

  float lambert = dot(l, n),
        ambientInt = 2.0,
        specularInt = 1.0,
        diffuseInt = 1.0,
        shininess = 256.0;

  float specular = pow(max(0.0, dot(r,v)), shininess);

  gl_FragColor = vec4(
      tColor.rgb *
      (lAmbient * ambientInt +
      lDiffuse * diffuseInt * lambert +
      lSpecular * specularInt * specular)
      , tColor.a);
}

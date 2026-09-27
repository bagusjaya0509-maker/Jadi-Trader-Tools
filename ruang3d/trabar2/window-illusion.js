import * as THREE from 'three';

// A distant panorama projected THROUGH the window. Only the existing flat pane
// is drawn: the virtual cylinder is ray math, never exterior building geometry.
export function createWindowPanorama(panorama){
  const material=new THREE.MeshBasicMaterial({
    map:panorama,color:'#ffffff',toneMapped:false,transparent:true,
    opacity:1,side:THREE.FrontSide,
  });
  material.name='Distant city window illusion';
  material.customProgramCacheKey=()=> 'distant-city-window-v1';
  material.onBeforeCompile=shader=>{
    shader.uniforms.cityHaze={value:new THREE.Color('#e2eaec')};
    shader.vertexShader='varying vec3 vCityWindowWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvCityWindowWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader='varying vec3 vCityWindowWorld;\nuniform vec3 cityHaze;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec3 ray = normalize( vCityWindowWorld - cameraPosition );
        vec3 origin = cameraPosition - vec3( -0.65, 1.7, 0.25 );
        float a = max( dot( ray.xz, ray.xz ), 0.0001 );
        float b = 2.0 * dot( origin.xz, ray.xz );
        float c = dot( origin.xz, origin.xz ) - 4900.0;
        float distanceToCity = max( 0.0, ( -b + sqrt( max( b*b - 4.0*a*c, 0.0 ) ) ) / ( 2.0*a ) );
        vec3 distantPoint = origin + ray * distanceToCity;
        float azimuth = atan( distantPoint.x, -distantPoint.z );
        float elevation = atan( distantPoint.y, max( length( distantPoint.xz ), 0.001 ) );
        vec2 cityUv = vec2( 0.5 + azimuth / 2.7, 0.44 + elevation / 0.9 );
        vec3 skyline = texture2D( map, clamp( cityUv, vec2(0.002), vec2(0.998) ) ).rgb;
        float horizonMist = 1.0 - smoothstep( 0.0, 0.34, abs( cityUv.y - 0.40 ) );
        skyline = mix( skyline, cityHaze, 0.07 + 0.13 * horizonMist );
        // Continue into soft sky at steep angles rather than stretching the
        // topmost image pixels. Keep the silhouette still, without heat wobble.
        float skyEdge = smoothstep( 0.94, 1.12, cityUv.y );
        float lowerEdge = 1.0 - smoothstep( -0.12, 0.025, cityUv.y );
        float sideEdge = smoothstep( 0.47, 0.66, abs( cityUv.x - 0.5 ) );
        skyline = mix( skyline, cityHaze, max( lowerEdge, max( skyEdge, sideEdge ) ) );
        diffuseColor.rgb *= skyline;
      #endif
    `);
  };
  return material;
}

export function createReflectiveGlazing(){
  return new THREE.MeshPhysicalMaterial({
    name:'Angle dependent architectural glazing',color:'#eaf0ed',
    metalness:.12,roughness:.075,clearcoat:1,clearcoatRoughness:.055,
    envMapIntensity:1.25,transparent:true,opacity:.075,
    depthWrite:false,side:THREE.FrontSide,
  });
}

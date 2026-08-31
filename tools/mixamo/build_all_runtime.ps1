param(
  [Parameter(Mandatory = $true)]
  [string]$Blender
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceRoot = Join-Path $repo 'local_assets\mixamo'
$output = Join-Path $sourceRoot 'output'
$builder = Join-Path $PSScriptRoot 'mixamo_aframe_batch_builder.py'
$optimizer = Join-Path $PSScriptRoot 'build_runtime_avatar.py'

Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'characters') -Filter '*.fbx' -File |
  Sort-Object Name |
  ForEach-Object {
    & $Blender --factory-startup --background --python-exit-code 1 `
      --python $builder -- $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Master build failed: $($_.Name)" }
  }

$jobs = @(
  @{ Source = 'Ch02_nonPBR_avatar.glb'; Destination = 'performers\female-ch02.glb'; Texture = 1024; Quality = 76; Clip = $null },
  @{ Source = 'Ch06_nonPBR_avatar.glb'; Destination = 'performers\male-ch06.glb'; Texture = 1024; Quality = 76; Clip = $null },
  @{ Source = 'Ch07_nonPBR_avatar.glb'; Destination = 'audience\female-ch07.glb'; Texture = 256; Quality = 64; Clip = 'SIT_Sitting_Idle1' },
  @{ Source = 'Ch21_nonPBR_avatar.glb'; Destination = 'audience\female-ch21.glb'; Texture = 256; Quality = 64; Clip = 'SIT_Sitting_Idle2' },
  @{ Source = 'Ch23_nonPBR_avatar.glb'; Destination = 'audience\male-ch23.glb'; Texture = 256; Quality = 64; Clip = 'SIT_Sitting_Idle1' },
  @{ Source = 'Ch31_nonPBR_avatar.glb'; Destination = 'audience\male-ch31.glb'; Texture = 256; Quality = 64; Clip = 'SIT_Sitting_Idle2' }
)

foreach ($job in $jobs) {
  $arguments = @(
    '--factory-startup', '--background', '--python-exit-code', '1',
    '--python', $optimizer, '--',
    (Join-Path $output $job.Source),
    (Join-Path $repo "public\avatars\active\$($job.Destination)"),
    '--max-texture', $job.Texture,
    '--quality', $job.Quality
  )
  if ($job.Clip) { $arguments += @('--clip', $job.Clip) }
  & $Blender @arguments
  if ($LASTEXITCODE -ne 0) { throw "Runtime build failed: $($job.Source)" }
}

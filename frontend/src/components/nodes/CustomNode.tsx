import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { getNodeDefinition } from '../../lib/nodes/nodeRegistry';

const nodeIcons: Record<string, string> = {
  play: '▶️',
  webhook: '🔗',
  clock: '⏰',
  globe: '🌐',
  code: '💻',
  'arrow-right': '➡️',
  sparkles: '✨',
  database: '🗄️',
  'git-branch': '🔀',
  repeat: '🔁',
  'git-merge': '🔀',
  file: '📄',
  mail: '📧',
};

interface CustomNodeProps extends NodeProps {
  isExecuting?: boolean;
  isCompleted?: boolean;
  hasError?: boolean;
}

function CustomNode({ data, selected, isExecuting, isCompleted, hasError }: CustomNodeProps) {
  const nodeDef = getNodeDefinition(data.type);
  const icon = nodeDef?.icon ? nodeIcons[nodeDef.icon] || '📦' : '📦';
  const name = nodeDef?.name || data.type;

  const hasBreakpoint = (data.breakpoint as boolean) || false;

  // Determine border color based on execution state
  let borderColor = selected ? 'border-blue-500' : 'border-gray-200';
  if (hasError) {
    borderColor = 'border-red-500';
  } else if (isExecuting) {
    borderColor = 'border-blue-500 border-2 animate-pulse';
  } else if (isCompleted) {
    borderColor = 'border-green-500';
  } else if (hasBreakpoint) {
    borderColor = 'border-orange-400 border-dashed';
  }

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 min-w-[150px] relative ${borderColor}`}
    >
      {hasBreakpoint && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
          ⏸
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">{name}</div>
          {data.label && data.label !== name && (
            <div className="text-xs text-gray-500">{data.label}</div>
          )}
        </div>
      </div>

      {/* Input handles */}
      {nodeDef?.inputs && nodeDef.inputs.length > 0 && (
        <div className="mt-2">
          {nodeDef.inputs.map((input, idx) => (
            <Handle
              key={`input-${idx}`}
              type="target"
              position={Position.Left}
              id={`input-${idx}`}
              style={{ top: `${20 + idx * 20}px` }}
              className="!bg-blue-500 !w-3 !h-3"
            />
          ))}
        </div>
      )}

      {/* Output handles */}
      {nodeDef?.outputs && nodeDef.outputs.length > 0 && (
        <div className="mt-2">
          {nodeDef.outputs.map((output, idx) => {
            // Use output name as handle ID for logic nodes (true/false, case names, etc.)
            const handleId = output.name || `output-${idx}`;
            const isErrorHandle = handleId === 'error';
            return (
              <div key={handleId} className="relative" style={{ top: `${20 + idx * 25}px` }}>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={handleId}
                  style={{ top: '0px' }}
                  className={isErrorHandle ? '!bg-red-500 !w-3 !h-3' : '!bg-green-500 !w-3 !h-3'}
                />
                {nodeDef.outputs.length > 1 && (
                  <span className={`absolute right-6 top-0 text-xs bg-white px-1 ${isErrorHandle ? 'text-red-600' : 'text-gray-600'}`}>
                    {output.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Default handle if no inputs/outputs defined */}
      {(!nodeDef?.inputs || nodeDef.inputs.length === 0) && (
        <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
      )}
      {(!nodeDef?.outputs || nodeDef.outputs.length === 0) && (
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
      )}
    </div>
  );
}

export default memo(CustomNode);


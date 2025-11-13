import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { WorkflowGroup } from '@sos/shared';

interface GroupNodeProps extends NodeProps {
  data: {
    group: WorkflowGroup;
    onUpdate?: (group: WorkflowGroup) => void;
    onDelete?: (groupId: string) => void;
  };
}

function GroupNode({ data, selected }: GroupNodeProps) {
  const { group } = data;

  return (
    <div
      className={`absolute border-2 rounded-lg ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
      style={{
        left: group.position.x,
        top: group.position.y,
        width: group.size.width,
        height: group.size.height,
        backgroundColor: group.style?.backgroundColor || 'rgba(243, 244, 246, 0.5)',
        borderColor: group.style?.borderColor || (selected ? '#3b82f6' : '#d1d5db'),
        borderWidth: group.style?.borderWidth || 2,
        pointerEvents: 'none', // Allow clicks to pass through to nodes
      }}
    >
      {/* Group Label */}
      <div
        className="absolute -top-6 left-0 px-2 py-1 text-xs font-semibold text-gray-700 bg-white rounded border border-gray-300 pointer-events-auto"
        style={{ minWidth: '100px' }}
      >
        {group.label}
      </div>
    </div>
  );
}

export default GroupNode;



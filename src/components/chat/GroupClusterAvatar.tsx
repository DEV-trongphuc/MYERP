import React from 'react';
import { Avatar } from '../ui/Avatar';

interface GroupClusterAvatarProps {
  participants?: Array<{
    id?: number | string;
    full_name?: string;
    name?: string;
    avatar_url?: string;
    avatar?: string;
  }>;
  avatarUrl?: string | null;
  name?: string;
  size?: number;
}

export const GroupClusterAvatar: React.FC<GroupClusterAvatarProps> = ({
  participants = [],
  avatarUrl,
  name = 'Nhóm',
  size = 40
}) => {
  // If group has an explicit custom avatar_url uploaded, show it directly
  if (avatarUrl && !avatarUrl.includes('default') && !avatarUrl.startsWith('data:image/svg')) {
    return <Avatar src={avatarUrl} name={name} size={size} />;
  }

  // Filter valid participants
  const validParts = (participants || []).filter(Boolean);

  // If no participants or only 1, fallback to single Avatar
  if (validParts.length <= 1) {
    return <Avatar src={avatarUrl} name={name} size={size} />;
  }

  // If 2 participants: 2 overlapping circles
  if (validParts.length === 2) {
    const subSize = Math.round(size * 0.65);
    const p1 = validParts[0];
    const p2 = validParts[1];

    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          position: 'relative', 
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, border: '1.5px solid #ffffff', borderRadius: '50%' }}>
          <Avatar 
            src={p1.avatar_url || p1.avatar} 
            name={p1.full_name || p1.name || 'U1'} 
            size={subSize} 
          />
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 2, border: '1.5px solid #ffffff', borderRadius: '50%' }}>
          <Avatar 
            src={p2.avatar_url || p2.avatar} 
            name={p2.full_name || p2.name || 'U2'} 
            size={subSize} 
          />
        </div>
      </div>
    );
  }

  // If 3 participants: 3 clustered circles (2 top, 1 bottom center)
  if (validParts.length === 3) {
    const subSize = Math.round(size * 0.52);
    const p1 = validParts[0];
    const p2 = validParts[1];
    const p3 = validParts[2];

    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          position: 'relative', 
          flexShrink: 0,
          borderRadius: '50%'
        }}
      >
        {/* Top left */}
        <div style={{ position: 'absolute', top: 0, left: 1, zIndex: 1, border: '1.5px solid #ffffff', borderRadius: '50%' }}>
          <Avatar src={p1.avatar_url || p1.avatar} name={p1.full_name || p1.name || '1'} size={subSize} />
        </div>
        {/* Top right */}
        <div style={{ position: 'absolute', top: 0, right: 1, zIndex: 2, border: '1.5px solid #ffffff', borderRadius: '50%' }}>
          <Avatar src={p2.avatar_url || p2.avatar} name={p2.full_name || p2.name || '2'} size={subSize} />
        </div>
        {/* Bottom center */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3, border: '1.5px solid #ffffff', borderRadius: '50%' }}>
          <Avatar src={p3.avatar_url || p3.avatar} name={p3.full_name || p3.name || '3'} size={subSize} />
        </div>
      </div>
    );
  }

  // 4 or more participants: 2x2 grid (3 avatars + 4th circle with remainder count)
  // Exactly matching screenshot 11!
  const subSize = Math.round(size * 0.50);
  const p1 = validParts[0];
  const p2 = validParts[1];
  const p3 = validParts[2];
  const remainingCount = validParts.length - 3;

  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        position: 'relative', 
        flexShrink: 0,
        borderRadius: '50%'
      }}
    >
      {/* 1: Top-Left */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, border: '1.5px solid #ffffff', borderRadius: '50%', overflow: 'hidden' }}>
        <Avatar src={p1.avatar_url || p1.avatar} name={p1.full_name || p1.name || '1'} size={subSize} />
      </div>

      {/* 2: Top-Right */}
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, border: '1.5px solid #ffffff', borderRadius: '50%', overflow: 'hidden' }}>
        <Avatar src={p2.avatar_url || p2.avatar} name={p2.full_name || p2.name || '2'} size={subSize} />
      </div>

      {/* 3: Bottom-Left */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 3, border: '1.5px solid #ffffff', borderRadius: '50%', overflow: 'hidden' }}>
        <Avatar src={p3.avatar_url || p3.avatar} name={p3.full_name || p3.name || '3'} size={subSize} />
      </div>

      {/* 4: Bottom-Right Number Circle */}
      <div 
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          right: 0, 
          zIndex: 4, 
          width: subSize, 
          height: subSize, 
          borderRadius: '50%', 
          border: '1.5px solid #ffffff', 
          background: '#1e293b', 
          color: '#ffffff',
          fontSize: subSize * 0.44,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
        title={`Còn ${remainingCount} thành viên khác`}
      >
        {remainingCount}
      </div>
    </div>
  );
};

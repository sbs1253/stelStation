'use client';

import { Avatar } from '@/components/ui/avatar';
import { AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';

export default function Header() {
  return (
    <div className="flex items-center justify-between p-4 border-b mb-4">
      <h1>Stel Station</h1>
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>profile</AvatarFallback>
      </Avatar>
    </div>
  );
}

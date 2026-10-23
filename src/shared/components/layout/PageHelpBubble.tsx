import { useState } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/shared/ui/atoms/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/ui/atoms/popover";

interface PageHelpBubbleProps {
	title: string;
	description: string;
}

export function PageHelpBubble({ title, description }: PageHelpBubbleProps) {
	const [open, setOpen] = useState(false);

	return (
		<div className="hidden md:block">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent focus-visible:ring-0"
						aria-label={`Afficher l'aide pour ${title}`}
					>
						<CircleHelp className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-72 text-sm leading-relaxed">
					<p className="font-medium text-foreground mb-2">{title}</p>
					<p className="text-muted-foreground whitespace-pre-line">
						{description}
					</p>
				</PopoverContent>
			</Popover>
		</div>
	);
}

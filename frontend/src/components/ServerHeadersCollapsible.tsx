"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WebhookMessage } from "@/types/webhook";

export function ServerHeadersCollapsible({
  message,
  serverHeaders,
}: {
  message: WebhookMessage;
  serverHeaders: Array<String>;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-6">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold opacity-75">
          Show server headers
        </h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2">
        <>
          <span className="text-2xl font-bold">Server headers:</span>
          <div className="w-full text-sm">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="hover:bg-primary border-secondary">
                  <TableHead className="w-[300px] px-0">Key</TableHead>
                  <TableHead className="px-0">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {message?.headers &&
                  Object.entries(message.headers)
                    .filter((header) => serverHeaders.includes(header[0]))
                    .map(([key, value]) => (
                      <TableRow
                        className="hover:bg-secondary border-secondary"
                        key={key}
                      >
                        <TableCell className="font-medium p-2">{key}</TableCell>
                        <TableCell className="p-0">{value}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default ServerHeadersCollapsible;

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";
import type { ReactNode } from "react";

export interface DataGridColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  className?: string;
}

export function DataGrid<T>({ columns, data, getRowKey, className }: DataGridProps<T>) {
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

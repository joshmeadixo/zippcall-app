import React from 'react';

interface FieldData {
  label: string;
  value: React.ReactNode;
}

interface MobileCardViewProps {
  items: Array<{
    id: string;
    fields: FieldData[];
    actions?: React.ReactNode;
  }>;
  className?: string;
}

/**
 * A mobile-friendly card view component to display data that would normally be in a table.
 * This component is designed to be shown on small screens as an alternative to tables.
 */
export default function MobileCardView({ items, className = '' }: MobileCardViewProps) {
  if (items.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <p className="text-gray-500 text-center py-4">No items found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item) => (
        <div 
          key={item.id} 
          className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"
        >
          <div className="space-y-2">
            {item.fields.map((field, index) => (
              <div key={index} className="flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {field.label}
                </span>
                <span className="text-sm text-gray-900 font-medium">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
          
          {item.actions && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              {item.actions}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 
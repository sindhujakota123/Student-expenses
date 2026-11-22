import { Car, Home, Receipt, ShoppingCart, Sofa, Ticket, UtensilsCrossed, Wifi, Zap, type LucideIcon } from 'lucide-react';

export const CATEGORIES: { name: string; icon: LucideIcon }[] = [
  { name: 'Rent', icon: Home },
  { name: 'Utilities', icon: Zap },
  { name: 'Internet', icon: Wifi },
  { name: 'Groceries', icon: ShoppingCart },
  { name: 'Household', icon: Sofa },
  { name: 'Dining', icon: UtensilsCrossed },
  { name: 'Transport', icon: Car },
  { name: 'Entertainment', icon: Ticket },
  { name: 'Other', icon: Receipt },
];

export const iconFor = (name: string) => CATEGORIES.find((c) => c.name === name)?.icon ?? Receipt;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'INR', 'SGD', 'MXN', 'BRL', 'ZAR'];

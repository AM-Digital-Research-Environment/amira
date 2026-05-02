import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import ModalHarness from './modal.test.harness.svelte';

afterEach(() => {
	cleanup();
	document.body.style.overflow = '';
});

describe('Modal', () => {
	it('does not render when closed', () => {
		render(ModalHarness, { props: { open: false } });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('renders dialog with aria-modal and a label when open', () => {
		render(ModalHarness, { props: { open: true, ariaLabel: 'Hello dialog' } });
		const dialog = screen.getByRole('dialog');
		expect(dialog).toBeInTheDocument();
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(dialog).toHaveAttribute('aria-label', 'Hello dialog');
	});

	it('passes aria-labelledby through and drops aria-label when both supplied', () => {
		render(ModalHarness, {
			props: { open: true, ariaLabel: 'fallback', ariaLabelledBy: 'lbl' }
		});
		const dialog = screen.getByRole('dialog');
		expect(dialog).toHaveAttribute('aria-labelledby', 'lbl');
		expect(dialog).not.toHaveAttribute('aria-label');
	});

	it('locks body scroll while open and restores it on close', async () => {
		const { rerender } = render(ModalHarness, { props: { open: true } });
		expect(document.body.style.overflow).toBe('hidden');
		await rerender({ open: false });
		expect(document.body.style.overflow).toBe('');
	});

	it('calls onClose when Escape is pressed', async () => {
		const onClose = vi.fn();
		render(ModalHarness, { props: { open: true, onClose } });
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when the backdrop itself is clicked', async () => {
		const onClose = vi.fn();
		render(ModalHarness, { props: { open: true, onClose } });
		const dialog = screen.getByRole('dialog');
		await fireEvent.click(dialog);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not call onClose when an inner element is clicked', async () => {
		const onClose = vi.fn();
		render(ModalHarness, { props: { open: true, onClose } });
		const inner = screen.getByTestId('inner');
		await fireEvent.click(inner);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('calls onClose when the built-in close button is clicked', async () => {
		const onClose = vi.fn();
		render(ModalHarness, { props: { open: true, onClose } });
		const close = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(close);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('hides the built-in close button when showClose=false', () => {
		render(ModalHarness, { props: { open: true, showClose: false } });
		expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
	});

	it('applies the start-alignment modifier when align="start"', () => {
		render(ModalHarness, { props: { open: true, align: 'start' } });
		const dialog = screen.getByRole('dialog');
		expect(dialog.className).toMatch(/modal-backdrop--start/);
	});
});

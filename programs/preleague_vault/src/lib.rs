use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

declare_id!("EtZ1sKD7NJ6Gd1vs8dSBFDjwTZ66XGUwgG9dCeZpXUaq");

#[program]
pub mod preleague_vault {
    use super::*;
    pub fn initialize_league(
        ctx: Context<InitializeLeague>,
        league_id: [u8; 32],
        prize_amount: u64,
    ) -> Result<()> {
        require!(prize_amount > 0, VaultError::InvalidAmount);
        let l = &mut ctx.accounts.league;
        l.authority = ctx.accounts.authority.key();
        l.league_id = league_id;
        l.prize_mint = ctx.accounts.mint.key();
        l.prize_amount = prize_amount;
        l.bump = ctx.bumps.league;
        Ok(())
    }
    pub fn fund_vault(ctx: Context<FundVault>) -> Result<()> {
        let l = &ctx.accounts.league;
        require!(
            !l.funded && !l.finalized && !l.cancelled,
            VaultError::InvalidState
        );
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            l.prize_amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.league.funded = true;
        Ok(())
    }
    pub fn set_winner(
        ctx: Context<SetWinner>,
        winner: Pubkey,
        settlement_hash: [u8; 32],
    ) -> Result<()> {
        let l = &mut ctx.accounts.league;
        require!(
            l.funded && !l.finalized && !l.cancelled,
            VaultError::InvalidState
        );
        require!(
            winner != Pubkey::default(),
            VaultError::InvalidWinner
        );
        require!(settlement_hash != [0; 32], VaultError::InvalidReceipt);
        l.winner = winner;
        l.settlement_hash = settlement_hash;
        l.finalized = true;
        Ok(())
    }
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let l = &ctx.accounts.league;
        require!(
            l.funded && l.finalized && !l.claimed && !l.cancelled,
            VaultError::InvalidState
        );
        let seeds: &[&[u8]] = &[b"league", &l.league_id, &[l.bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: l.to_account_info(),
                },
                &[seeds],
            ),
            l.prize_amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.league.claimed = true;
        Ok(())
    }
    pub fn cancel_league(ctx: Context<CancelLeague>) -> Result<()> {
        let l = &ctx.accounts.league;
        require!(!l.finalized && !l.cancelled, VaultError::InvalidState);
        let seeds: &[&[u8]] = &[b"league", &l.league_id, &[l.bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: l.to_account_info(),
                },
                &[seeds],
            ),
            ctx.accounts.vault.amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.league.cancelled = true;
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct League {
    pub authority: Pubkey,
    pub league_id: [u8; 32],
    pub prize_mint: Pubkey,
    pub prize_amount: u64,
    pub winner: Pubkey,
    pub settlement_hash: [u8; 32],
    pub funded: bool,
    pub finalized: bool,
    pub claimed: bool,
    pub cancelled: bool,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(league_id: [u8; 32])]
pub struct InitializeLeague<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + League::INIT_SPACE, seeds = [b"league", league_id.as_ref()], bump)]
    pub league: Account<'info, League>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer = authority, associated_token::mint = mint, associated_token::authority = league)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct FundVault<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"league", league.league_id.as_ref()], bump = league.bump, has_one = authority, constraint = league.prize_mint == mint.key())]
    pub league: Account<'info, League>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = authority)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = league)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct SetWinner<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"league", league.league_id.as_ref()], bump = league.bump, has_one = authority)]
    pub league: Account<'info, League>,
}
#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,
    #[account(mut, seeds = [b"league", league.league_id.as_ref()], bump = league.bump, has_one = winner, constraint = league.prize_mint == mint.key())]
    pub league: Account<'info, League>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = league)]
    pub vault: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = winner, associated_token::mint = mint, associated_token::authority = winner)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CancelLeague<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"league", league.league_id.as_ref()], bump = league.bump, has_one = authority, constraint = league.prize_mint == mint.key())]
    pub league: Account<'info, League>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = league)]
    pub vault: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = authority, associated_token::mint = mint, associated_token::authority = authority)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
#[error_code]
pub enum VaultError {
    #[msg("Invalid prize amount")]
    InvalidAmount,
    #[msg("This operation is not allowed in the current league state")]
    InvalidState,
    #[msg("Winner must be a wallet address")]
    InvalidWinner,
    #[msg("Settlement commitment is required")]
    InvalidReceipt,
}

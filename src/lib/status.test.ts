import { describe, expect, it } from 'vitest'
import { availableTransitions } from './status'
import type { Profile, Task, TaskStatus } from './types'

const manager = { id: 'manager', role: 'manager' } as Profile
const worker = { id: 'worker', role: 'executor' } as Profile
const otherWorker = { id: 'other', role: 'executor' } as Profile
const task = (status: TaskStatus) => ({ status, assignee_id: 'worker' }) as Task

describe('visible task actions', () => {
  it('offers only the manager decisions at review', () => {
    expect(availableTransitions(manager, task('review'))).toEqual([
      'accepted',
      'revision'
    ])
    expect(availableTransitions(manager, task('new'))).toEqual([])
  })

  it('offers worker steps only for their own task', () => {
    expect(availableTransitions(worker, task('new'))).toEqual(['in_progress'])
    expect(availableTransitions(worker, task('in_progress'))).toEqual([
      'review'
    ])
    expect(availableTransitions(worker, task('revision'))).toEqual([
      'in_progress'
    ])
    expect(availableTransitions(worker, task('accepted'))).toEqual([])
    expect(availableTransitions(otherWorker, task('new'))).toEqual([])
  })
})

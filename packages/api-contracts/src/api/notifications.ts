export interface NotificationTargetDto {
  type: string
  id: string
}

export interface NotificationDto {
  id: string
  event: string
  message: string
  isRead: boolean
  target: NotificationTargetDto
  createdAt: string
}

export interface NotificationInboxDto {
  items: NotificationDto[]
  unreadCount: number
}

export interface NotificationReadRequest {
  isRead: boolean
}
